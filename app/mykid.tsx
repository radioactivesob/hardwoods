import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { useKidStats, IN_PROGRESS_KEY } from '../hooks/useKidStats';
import { parseTransfer, planMerge, matchProfile, toGameEntry } from '../hooks/kidTransfer';
import { STAT_DEFS, StatKey, MAX_ENABLED_STATS, STAT_ORDER, KidProfile, pointsFromTotals, KID_COLORS, DEFAULT_KID_COLOR, kidColor, profileSeason, gameSeason } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const ALL_ORIENTATIONS = ['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right'] as const;

export default function MyKid() {
  useAllOrientations();
  const router = useRouter();
  const { profiles, loading, addProfile, updateProfile, deleteProfile, gamesForKid, startNewSeason, importGames, importProfile, reload } = useKidStats();
  // A paused game shows on its kid's card and turns START into RESUME.
  // Re-read on every focus — this screen is where you land after pausing.
  const [liveGame, setLiveGame] = useState<{ kidId: string; count: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      // Games saved elsewhere land in storage while this screen is still
      // mounted underneath, so re-read rather than trusting mount-time state.
      reload();
      AsyncStorage.getItem(IN_PROGRESS_KEY).then(raw => {
        if (raw) {
          const saved = JSON.parse(raw);
          setLiveGame(saved.events?.length > 0 ? { kidId: saved.kidId, count: saved.events.length } : null);
        } else {
          setLiveGame(null);
        }
      });
    }, [reload]),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_KID_COLOR);

  const selected = profiles.find(p => p.id === selectedId) ?? null;

  const handleAdd = () => {
    if (!newName.trim()) {
      Alert.alert('Name Required', "Enter your kid's name to create a profile.");
      return;
    }
    const profile = addProfile(newName.trim(), newNumber.trim() || undefined, newTeam.trim() || undefined, newColor);
    setNewName(''); setNewNumber(''); setNewTeam(''); setNewColor(DEFAULT_KID_COLOR);
    setShowAdd(false);
    setSelectedId(profile.id);
  };

  const handleDelete = (profile: KidProfile) => {
    const games = gamesForKid(profile.id).length;
    Alert.alert(
      'Delete Profile?',
      games > 0
        ? `This removes ${profile.name} and all ${games} saved game${games === 1 ? '' : 's'}. This cannot be undone.`
        : `Remove ${profile.name}'s profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteProfile(profile.id); setSelectedId(null); } },
      ],
    );
  };

  const toggleStat = (profile: KidProfile, key: StatKey) => {
    const enabled = profile.enabledStats.includes(key);
    if (!enabled && profile.enabledStats.length >= MAX_ENABLED_STATS) {
      Alert.alert(`${MAX_ENABLED_STATS} Stats Max`, 'Turn off another stat first — a bigger grid gets hard to tap accurately from the stands.');
      return;
    }
    updateProfile(profile.id, {
      enabledStats: enabled
        ? profile.enabledStats.filter(k => k !== key)
        : [...STAT_ORDER.filter(k => profile.enabledStats.includes(k) || k === key)],
    });
  };

  const startGame = (profile: KidProfile) => {
    if (profile.enabledStats.length === 0) {
      Alert.alert('No Stats Enabled', 'Turn on at least one stat to track before starting a game.');
      return;
    }
    // Starting a different kid's game would overwrite a paused one —
    // make that an explicit choice, never an accident.
    if (liveGame && liveGame.kidId !== profile.id) {
      const liveKid = profiles.find(p => p.id === liveGame.kidId);
      Alert.alert(
        'Game In Progress',
        `${liveKid?.name ?? 'Another kid'} has a paused game with ${liveGame.count} stat${liveGame.count === 1 ? '' : 's'}. Starting a game for ${profile.name} will discard it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard & Start',
            style: 'destructive',
            onPress: () => {
              AsyncStorage.removeItem(IN_PROGRESS_KEY);
              setLiveGame(null);
              router.push({ pathname: '/kidgame', params: { kidId: profile.id } });
            },
          },
        ],
      );
      return;
    }
    router.push({ pathname: '/kidgame', params: { kidId: profile.id } });
  };

  const seasonSummary = (profile: KidProfile) => {
    const season = profileSeason(profile);
    const games = gamesForKid(profile.id).filter(g => gameSeason(g) === season);
    const prefix = season > 1 ? `Season ${season} · ` : '';
    if (games.length === 0) return `${prefix}No games yet`;
    const totalPoints = games.reduce((sum, g) => sum + pointsFromTotals(g.totals), 0);
    const ppg = (totalPoints / games.length).toFixed(1);
    return `${prefix}${games.length} game${games.length === 1 ? '' : 's'} · ${ppg} pts/game`;
  };

  /**
   * Merge games another parent tracked and sent over. The file names the
   * player, so this figures out which profile it belongs to rather than
   * asking, and reports exactly what it will and won't add.
   */
  const importFromFile = async () => {
    let json: unknown;
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
      if (picked.canceled || !picked.result) return;
      json = JSON.parse(await picked.result.text());
    } catch {
      Alert.alert('Could Not Read File', "That file couldn't be opened, or isn't Hardwoods data.");
      return;
    }

    const parsed = parseTransfer(json);
    if (!parsed.ok) {
      Alert.alert('Could Not Import', parsed.error);
      return;
    }
    const file = parsed.file;
    const target = matchProfile(file.player, profiles);
    const count = file.games.length;

    // No profile by that name — offer to build one from the file, which also
    // brings across the stat set so both phones stay in step.
    if (!target) {
      Alert.alert(
        `Add ${file.player.name}?`,
        `You don't have a player called ${file.player.name}. Create the profile and add ${count} game${count === 1 ? '' : 's'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create & Import',
            onPress: () => {
              const created = importProfile(file.player);
              const added = importGames(file.games.map(g => toGameEntry(g, created.id, 1)));
              setSelectedId(created.id);
              Alert.alert('Imported', `${file.player.name} added with ${added} game${added === 1 ? '' : 's'}.`);
            },
          },
        ],
      );
      return;
    }

    const plan = planMerge(file, gamesForKid(target.id), target.id);
    const season = profileSeason(target);
    const parts: string[] = [];
    if (plan.fresh.length) parts.push(`${plan.fresh.length} new game${plan.fresh.length === 1 ? '' : 's'}`);
    if (plan.alreadyHave.length) parts.push(`${plan.alreadyHave.length} already imported`);
    if (plan.possibleOverlap.length) parts.push(
      plan.possibleOverlap.length === 1
        ? '1 that looks like a game you already have'
        : `${plan.possibleOverlap.length} that look like games you already have`,
    );

    if (plan.fresh.length === 0 && plan.possibleOverlap.length === 0) {
      Alert.alert(
        'Nothing New',
        count === 1
          ? 'You already have that game.'
          : `You already have all ${count} games in that file.`,
      );
      return;
    }

    const addTo = (games: typeof plan.fresh) => {
      const added = importGames(games.map(g => toGameEntry(g, target.id, season)));
      Alert.alert('Imported', `${added} game${added === 1 ? '' : 's'} added to ${target.name}.`);
    };

    Alert.alert(
      `Import to ${target.name}?`,
      `This file has ${parts.join(', ')}.` +
        (plan.possibleOverlap.length
          ? '\n\nGames on the same day against the same opponent may be the same game tracked twice.'
          : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        ...(plan.fresh.length
          ? [{ text: `Add ${plan.fresh.length} New`, onPress: () => addTo(plan.fresh) }]
          : []),
        ...(plan.possibleOverlap.length
          ? [{
              text: `Add All ${plan.fresh.length + plan.possibleOverlap.length}`,
              onPress: () => addTo([...plan.fresh, ...plan.possibleOverlap.map(o => o.incoming)]),
            }]
          : []),
      ],
    );
  };

  const handleNewSeason = (profile: KidProfile) => {
    const season = profileSeason(profile);
    const gamesThisSeason = gamesForKid(profile.id).filter(g => gameSeason(g) === season).length;
    if (gamesThisSeason === 0) {
      Alert.alert('No Games This Season', `Season ${season} has no games yet — new games already count toward it.`);
      return;
    }
    Alert.alert(
      `Start Season ${season + 1}?`,
      `Season ${season} (${gamesThisSeason} game${gamesThisSeason === 1 ? '' : 's'}) stays saved — you can revisit it anytime from the season view. New games will count toward Season ${season + 1}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start New Season', onPress: () => startNewSeason(profile.id) },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>MY KID</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ ADD</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!loading && profiles.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Track your kid from the stands</Text>
            <Text style={styles.emptyHint}>
              Create a profile, pick the stats you care about, and tap along during games.
              Watch their season take shape game by game.
            </Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAdd(true)}>
              <Text style={styles.emptyAddBtnText}>+ CREATE FIRST PROFILE</Text>
            </TouchableOpacity>
          </View>
        )}

        {profiles.map(profile => (
          <View key={profile.id}>
            <TouchableOpacity
              style={[styles.kidCard, selectedId === profile.id && styles.kidCardActive]}
              onPress={() => setSelectedId(selectedId === profile.id ? null : profile.id)}
            >
              <View style={[styles.kidBadge, { borderColor: kidColor(profile) }]}>
                <Text style={[styles.kidBadgeText, { color: kidColor(profile) }]}>
                  {profile.number ? `#${profile.number}` : profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.kidName}>{profile.name}</Text>
                  {liveGame?.kidId === profile.id && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>● GAME IN PROGRESS</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.kidMeta}>
                  {profile.teamName ? `${profile.teamName} · ` : ''}{seasonSummary(profile)}
                </Text>
              </View>
              <Text style={styles.kidChevron}>{selectedId === profile.id ? '▾' : '▸'}</Text>
            </TouchableOpacity>

            {selectedId === profile.id && (
              <View style={styles.detail}>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.startBtn, { flex: 1.6 }]} onPress={() => startGame(profile)}>
                    <Text style={styles.startBtnText} numberOfLines={1} adjustsFontSizeToFit>
                      {liveGame?.kidId === profile.id ? '▶ RESUME GAME' : '▶ START GAME'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.seasonBtn}
                    onPress={() => router.push({ pathname: '/kidexport', params: { kidId: profile.id } })}
                  >
                    <Text style={styles.seasonBtnText} numberOfLines={1} adjustsFontSizeToFit>
                      SHARE
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.seasonBtn}
                    onPress={() => router.push({ pathname: '/kidseason', params: { kidId: profile.id } })}
                  >
                    <Text style={styles.seasonBtnText} numberOfLines={1} adjustsFontSizeToFit>
                      SEASON
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionLabel}>COLOR</Text>
                <View style={styles.colorRow}>
                  {KID_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, kidColor(profile) === c && styles.colorSwatchActive]}
                      onPress={() => updateProfile(profile.id, { color: c })}
                    />
                  ))}
                </View>

                <Text style={styles.sectionLabel}>
                  STATS TO TRACK ({profile.enabledStats.length}/{MAX_ENABLED_STATS})
                </Text>
                <Text style={styles.sectionHint}>These become the tap buttons during a game.</Text>
                <TouchableOpacity onPress={() => router.push('/statsguide')}>
                  <Text style={styles.guideLink}>ⓘ What do these stats mean?</Text>
                </TouchableOpacity>
                <View style={styles.statGrid}>
                  {STAT_ORDER.map(key => {
                    const on = profile.enabledStats.includes(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.statChip, on && styles.statChipOn]}
                        onPress={() => toggleStat(profile, key)}
                      >
                        <Text style={[styles.statChipText, on && styles.statChipTextOn]}>
                          {STAT_DEFS[key].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.newSeasonBtn}
                  onPress={() => router.push({ pathname: '/kidmanual', params: { kidId: profile.id } })}
                >
                  <Text style={styles.newSeasonBtnText}>✎ ADD A GAME BY HAND</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.newSeasonBtn} onPress={() => handleNewSeason(profile)}>
                  <Text style={styles.newSeasonBtnText}>⟳ START NEW SEASON</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.deleteRow} onPress={() => handleDelete(profile)}>
                  <Text style={styles.deleteRowText}>DELETE PROFILE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {!loading && (
          <TouchableOpacity style={styles.importRow} onPress={importFromFile}>
            <Text style={styles.importText}>⤓ IMPORT GAMES FROM A FILE</Text>
            <Text style={styles.importHint}>
              Games another parent tracked and sent you
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      <Modal
        visible={showAdd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdd(false)}
        supportedOrientations={[...ALL_ORIENTATIONS]}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>NEW PROFILE</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>NAME</Text>
              <TextInput
                style={styles.textInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Kid's name"
                placeholderTextColor="#444"
                autoFocus
              />
              <View style={styles.inputRow}>
                <View style={{ width: 90 }}>
                  <Text style={styles.inputLabel}>NUMBER</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newNumber}
                    onChangeText={setNewNumber}
                    placeholder="#"
                    placeholderTextColor="#444"
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>TEAM (OPTIONAL)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newTeam}
                    onChangeText={setNewTeam}
                    placeholder="Team name"
                    placeholderTextColor="#444"
                  />
                </View>
              </View>
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>COLOR</Text>
              <View style={styles.colorRow}>
                {KID_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatch, { backgroundColor: c }, newColor === c && styles.colorSwatchActive]}
                    onPress={() => setNewColor(c)}
                  />
                ))}
              </View>
              <TouchableOpacity style={styles.createBtn} onPress={handleAdd}>
                <Text style={styles.createBtnText}>CREATE PROFILE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0D0700', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: '#8B6914',
  },
  backText: { color: '#8B6914', fontSize: 13, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  addBtn: { backgroundColor: '#8B6914', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  emptyAddBtn: {
    backgroundColor: '#8B6914', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyAddBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  kidCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0700',
    borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginBottom: 8, gap: 12,
  },
  kidCardActive: { borderColor: '#8B6914' },
  kidBadge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A0F00',
    borderWidth: 2, borderColor: '#8B6914', justifyContent: 'center', alignItems: 'center',
  },
  kidBadgeText: { color: '#C8A040', fontSize: 14, fontWeight: '900' },
  kidName: { color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  kidMeta: { color: '#666', fontSize: 11 },
  liveBadge: {
    backgroundColor: '#1E3B1E', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  liveBadgeText: { color: '#4CAF50', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  kidChevron: { color: '#8B6914', fontSize: 14 },
  detail: {
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginBottom: 8, marginTop: -4,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'stretch' },
  startBtn: {
    backgroundColor: '#8B6914', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  seasonBtn: {
    flex: 1, backgroundColor: '#0D0700', borderWidth: 1, borderColor: '#8B6914',
    borderRadius: 8, paddingVertical: 14, alignItems: 'center',
  },
  seasonBtnText: { color: '#C8A040', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  sectionLabel: { color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  sectionHint: { color: '#555', fontSize: 10, fontStyle: 'italic', marginBottom: 4 },
  guideLink: { color: '#C8A040', fontSize: 11, fontWeight: '700', marginBottom: 10 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statChip: {
    borderWidth: 1, borderColor: '#2A1A00', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1A0F00',
  },
  statChipOn: { borderColor: '#C8A040', backgroundColor: '#3D2800' },
  statChipText: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statChipTextOn: { color: '#C8A040' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16, marginTop: 4 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#FFF', transform: [{ scale: 1.15 }] },
  newSeasonBtn: {
    borderWidth: 1, borderColor: '#3D2800', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', marginTop: 16,
  },
  newSeasonBtnText: { color: '#C8A040', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  importRow: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#3D2800', borderRadius: 8,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  importText: { color: '#C8A040', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  importHint: { color: '#5A4210', fontSize: 10, marginTop: 3 },
  deleteRow: { alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  deleteRowText: { color: '#7A1A1A', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: '#1A0F00', borderRadius: 12, borderWidth: 1, borderColor: '#8B6914',
    width: '85%', maxWidth: 420,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#2A1A00',
  },
  modalTitle: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  closeBtn: { color: '#666', fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },
  modalBody: { padding: 16 },
  inputLabel: { color: '#8B6914', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  textInput: {
    backgroundColor: '#0D0700', color: '#FFF', borderWidth: 1, borderColor: '#2A1A00',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, fontWeight: '600',
  },
  createBtn: {
    backgroundColor: '#8B6914', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', marginTop: 20,
  },
  createBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
