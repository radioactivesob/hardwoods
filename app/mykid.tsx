import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useKidStats } from '../hooks/useKidStats';
import { STAT_DEFS, StatKey, MAX_ENABLED_STATS, STAT_ORDER, KidProfile, pointsFromTotals, KID_COLORS, DEFAULT_KID_COLOR, kidColor, profileSeason, gameSeason } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const ALL_ORIENTATIONS = ['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right'] as const;

export default function MyKid() {
  useAllOrientations();
  const router = useRouter();
  const { profiles, loading, addProfile, updateProfile, deleteProfile, gamesForKid, startNewSeason } = useKidStats();
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
                <Text style={styles.kidName}>{profile.name}</Text>
                <Text style={styles.kidMeta}>
                  {profile.teamName ? `${profile.teamName} · ` : ''}{seasonSummary(profile)}
                </Text>
              </View>
              <Text style={styles.kidChevron}>{selectedId === profile.id ? '▾' : '▸'}</Text>
            </TouchableOpacity>

            {selectedId === profile.id && (
              <View style={styles.detail}>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.startBtn, { flex: 2 }]} onPress={() => startGame(profile)}>
                    <Text style={styles.startBtnText}>▶ START GAME</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.seasonBtn}
                    onPress={() => router.push({ pathname: '/kidseason', params: { kidId: profile.id } })}
                  >
                    <Text style={styles.seasonBtnText}>📈 SEASON</Text>
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
  kidChevron: { color: '#8B6914', fontSize: 14 },
  detail: {
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginBottom: 8, marginTop: -4,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
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
  sectionHint: { color: '#555', fontSize: 10, fontStyle: 'italic', marginBottom: 10 },
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
