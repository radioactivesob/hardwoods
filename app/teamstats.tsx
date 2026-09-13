import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTeamLibrary, SavedTeam } from '../hooks/useTeamLibrary';
import { STAT_DEFS, StatKey, MAX_ENABLED_STATS, STAT_ORDER } from '../hooks/kidStats';
import { teamEnabledStats, TeamStatsInProgress, TEAM_STATS_IN_PROGRESS_KEY } from '../hooks/teamStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

/**
 * Team Stats: pick a saved team, decide which stats to track, start tapping.
 * Rosters come from the same library the Full Scorebook uses — one team,
 * one place to maintain it, whichever mode you're in.
 */
export default function TeamStats() {
  useAllOrientations();
  const router = useRouter();
  const { library, loading, setTeamStats, reload } = useTeamLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inProgress, setInProgress] = useState<TeamStatsInProgress | null>(null);

  // The roster may have been edited in Team Setup while this screen sat
  // underneath; a paused game may have been finished. Refresh on focus.
  useFocusEffect(useCallback(() => {
    reload();
    AsyncStorage.getItem(TEAM_STATS_IN_PROGRESS_KEY).then(raw => {
      setInProgress(raw ? JSON.parse(raw) : null);
    });
  }, [reload]));

  useEffect(() => {
    if (!selectedId && library.length > 0) setSelectedId(inProgress?.teamId ?? library[0].id);
  }, [library, selectedId, inProgress]);

  const team = library.find(t => t.id === selectedId) ?? null;
  const enabled = team ? teamEnabledStats(team) : [];
  const resumable = inProgress && inProgress.teamId === selectedId && inProgress.events.length > 0;

  const toggleStat = (t: SavedTeam, key: StatKey) => {
    const current = teamEnabledStats(t);
    const on = current.includes(key);
    if (!on && current.length >= MAX_ENABLED_STATS) {
      Alert.alert(`${MAX_ENABLED_STATS} Stats Max`, 'Turn off another stat first — a bigger grid gets hard to tap accurately from the stands.');
      return;
    }
    const next = on
      ? current.filter(k => k !== key)
      : STAT_ORDER.filter(k => current.includes(k) || k === key);
    setTeamStats(t.id, next);
  };

  const start = () => {
    if (!team) return;
    if (enabled.length === 0) {
      Alert.alert('No Stats Enabled', 'Turn on at least one stat to track before starting a game.');
      return;
    }
    if (inProgress && inProgress.events.length > 0 && inProgress.teamId !== team.id) {
      const other = library.find(t => t.id === inProgress.teamId)?.name ?? 'another team';
      Alert.alert(
        'Game In Progress',
        `There's an unfinished game for ${other}. Starting a new one will discard it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard & Start', style: 'destructive',
            onPress: () => {
              AsyncStorage.removeItem(TEAM_STATS_IN_PROGRESS_KEY);
              router.push({ pathname: '/teamstatsgame', params: { teamId: team.id } });
            },
          },
        ],
      );
      return;
    }
    router.push({ pathname: '/teamstatsgame', params: { teamId: team.id } });
  };

  if (loading) return <SafeAreaView style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← HOME</Text>
        </TouchableOpacity>
        <Text style={styles.title}>TEAM STATS</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {library.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No saved teams yet</Text>
            <Text style={styles.emptyHint}>
              Team Stats uses the same rosters as the Full Scorebook. Build the team
              once in Team Setup, save it to the library, and it shows up here.
            </Text>
            <TouchableOpacity style={styles.rosterBtn} onPress={() => router.push('/teams')}>
              <Text style={styles.rosterBtnText}>SET UP A TEAM</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>TEAM</Text>
            {library.map(t => {
              const on = t.id === selectedId;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.teamRow, on && { borderColor: t.color }]}
                  onPress={() => setSelectedId(t.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.colorDot, { backgroundColor: t.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.teamName, on && { color: t.color }]}>{t.name}</Text>
                    <Text style={styles.teamMeta}>
                      {t.players.filter(p => p.name || p.number).length} players
                      {t.coachName ? ` · ${t.coachName}` : ''}
                    </Text>
                  </View>
                  {on && <Text style={[styles.check, { color: t.color }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.rosterLink} onPress={() => router.push('/teams')}>
              <Text style={styles.rosterLinkText}>EDIT ROSTERS IN TEAM SETUP ›</Text>
            </TouchableOpacity>

            {team && (
              <>
                <Text style={styles.sectionLabel}>
                  STATS TO TRACK ({enabled.length}/{MAX_ENABLED_STATS})
                </Text>
                <Text style={styles.hint}>
                  Saved with the team. Keep it the same all season so the averages compare cleanly.
                </Text>
                <View style={styles.chipGrid}>
                  {STAT_ORDER.map(key => {
                    const on = enabled.includes(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.statChip, on && styles.statChipOn]}
                        onPress={() => toggleStat(team, key)}
                      >
                        <Text style={[styles.statChipText, on && styles.statChipTextOn]}>
                          {STAT_DEFS[key].label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {team && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: team.color }]} onPress={start}>
            <Text style={styles.startText} numberOfLines={1} adjustsFontSizeToFit>
              {resumable ? `▶ RESUME — ${team.name.toUpperCase()}` : `▶ START GAME — ${team.name.toUpperCase()}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0D0700', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: '#8B6914',
  },
  backText: { color: '#8B6914', fontSize: 13, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  scroll: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  sectionLabel: {
    color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginBottom: 10, marginTop: 8,
  },
  hint: { color: '#555', fontSize: 11, lineHeight: 16, marginBottom: 10, marginTop: -4 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  rosterBtn: { backgroundColor: '#8B6914', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
  rosterBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 12, marginBottom: 8,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  teamName: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  teamMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  check: { fontSize: 18, fontWeight: '900' },
  rosterLink: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 8 },
  rosterLinkText: { color: '#8B6914', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statChip: {
    borderWidth: 1, borderColor: '#2A1A00', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1A0F00',
  },
  statChipOn: { borderColor: '#C8A040', backgroundColor: '#3D2800' },
  statChipText: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statChipTextOn: { color: '#C8A040' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#2A1A00', backgroundColor: '#0D0700' },
  startBtn: { borderRadius: 10, paddingVertical: 15, paddingHorizontal: 14, alignItems: 'center' },
  startText: { color: '#1A0F00', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
});
