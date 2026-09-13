import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ScorePrompt from '../components/ScorePrompt';
import { useTeamLibrary } from '../hooks/useTeamLibrary';
import { useTeamGames } from '../hooks/useTeamGames';
import { useKidStats } from '../hooks/useKidStats';
import { STAT_DEFS, StatKey, sortByStatOrder, pointsFromTotals, findProfileForPlayer } from '../hooks/kidStats';
import {
  TeamStatEvent, TeamStatsInProgress, TEAM_STATS_IN_PROGRESS_KEY,
  teamEnabledStats, totalsByPlayer, eventsForPlayer, archivedGameFromTeamStats,
} from '../hooks/teamStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

/**
 * The Team Stats tap screen. Pick a player on the strip, tap a stat. The
 * selection sticks, so a rebound-then-putback for the same player is one
 * tap each. Every tap is persisted; a dead battery loses nothing.
 */
export default function TeamStatsGame() {
  useAllOrientations();
  useKeepAwake();
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { library, loading } = useTeamLibrary();
  const { archiveGame, loading: archiveLoading } = useTeamGames();
  const { profiles, saveGame, loading: kidsLoading } = useKidStats();

  const team = library.find(t => t.id === teamId) ?? null;

  const [events, setEvents] = useState<TeamStatEvent[]>([]);
  const [out, setOut] = useState<number[]>([]);
  const [opponent, setOpponent] = useState('');
  const [startedAt, setStartedAt] = useState(Date.now());
  const [selected, setSelected] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [showScorePrompt, setShowScorePrompt] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(TEAM_STATS_IN_PROGRESS_KEY).then(raw => {
      if (raw) {
        const saved: TeamStatsInProgress = JSON.parse(raw);
        if (saved.teamId === teamId) {
          setEvents(saved.events);
          setOut(saved.out ?? []);
          setOpponent(saved.opponent);
          setStartedAt(saved.startedAt);
        }
      }
      setRestored(true);
    });
  }, [teamId]);

  const persist = useCallback((next: Partial<TeamStatsInProgress>) => {
    const snapshot: TeamStatsInProgress = {
      teamId: teamId!, opponent, startedAt, events, out, ...next,
    };
    AsyncStorage.setItem(TEAM_STATS_IN_PROGRESS_KEY, JSON.stringify(snapshot));
  }, [teamId, opponent, startedAt, events, out]);

  const tap = (key: StatKey) => {
    if (selected === null) {
      Alert.alert('Pick a Player', 'Tap a number on the strip first, then the stat.');
      return;
    }
    const next = [...events, { player: selected, key, at: Date.now() }];
    setEvents(next);
    persist({ events: next });
  };

  const undo = () => {
    const next = events.slice(0, -1);
    setEvents(next);
    persist({ events: next });
  };

  const changeOpponent = (v: string) => {
    setOpponent(v);
    persist({ opponent: v });
  };

  const toggleOut = (idx: number) => {
    if (!team) return;
    const p = team.players[idx];
    const isOut = out.includes(idx);
    Alert.alert(
      isOut ? `#${p.number} ${p.name} is back?` : `#${p.number} ${p.name} out tonight?`,
      isOut
        ? 'Back on the strip and counting games played again.'
        : "Stays on the roster, comes off the strip, and won't count as a game played.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOut ? 'Back In' : 'Mark Out',
          onPress: () => {
            const next = isOut ? out.filter(i => i !== idx) : [...out, idx];
            setOut(next);
            if (selected === idx) setSelected(null);
            persist({ out: next });
          },
        },
      ],
    );
  };

  const endGame = () => {
    if (events.length === 0) {
      Alert.alert('Nothing Tracked', 'No stats recorded yet. Leave without saving?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => { AsyncStorage.removeItem(TEAM_STATS_IN_PROGRESS_KEY); router.back(); } },
      ]);
      return;
    }
    Alert.alert(
      'End Game?',
      `Save this game for ${team?.name}? (${events.length} stat${events.length === 1 ? '' : 's'} recorded)`,
      [
        { text: 'Keep Tracking', style: 'cancel' },
        { text: 'Save Game', onPress: () => setShowScorePrompt(true) },
        {
          text: 'Discard', style: 'destructive',
          onPress: () => {
            Alert.alert('Discard Game?', 'All taps from this game will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => { AsyncStorage.removeItem(TEAM_STATS_IN_PROGRESS_KEY); router.back(); } },
            ]);
          },
        },
      ],
    );
  };

  const finish = (score: { us: number; them: number }) => {
    if (!team) return;
    // Both stores write "everything they hold" — saving before they've
    // loaded would replace the archive with this one game.
    if (archiveLoading || kidsLoading) {
      Alert.alert('One Moment', 'Still loading saved games — try again in a second.');
      return;
    }
    setShowScorePrompt(false);
    const game = archivedGameFromTeamStats(team, opponent, score, events, out, startedAt);
    archiveGame(game);
    AsyncStorage.removeItem(TEAM_STATS_IN_PROGRESS_KEY);

    // Any player with a My Kid profile on this phone gets their line saved
    // there too — with the full stat set, not the scorebook's subset.
    const matches = team.players
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => !out.includes(i) && eventsForPlayer(events, i).length > 0)
      .map(({ p, i }) => ({
        i,
        profile: findProfileForPlayer(profiles, p, team.players),
      }))
      .filter((m): m is { i: number; profile: NonNullable<typeof m.profile> } => !!m.profile);

    const goShare = () => router.replace({ pathname: '/teamstatsshare', params: { gameId: game.id } });

    if (matches.length === 0) {
      goShare();
      return;
    }
    const names = matches.map(m => m.profile.name).join(', ');
    Alert.alert(
      `Save to ${names}?`,
      matches.length === 1
        ? `${matches[0].profile.name} has a My Kid profile on this phone. Add this game's stats to it?`
        : 'They have My Kid profiles on this phone. Add this game\'s stats to them?',
      [
        { text: 'Not Now', style: 'cancel', onPress: goShare },
        {
          text: 'Save',
          onPress: () => {
            matches.forEach(m => {
              saveGame(m.profile.id, eventsForPlayer(events, m.i), {
                opponent, date: startedAt, teamScore: score,
              });
            });
            goShare();
          },
        },
      ],
    );
  };

  if (!team || !restored || loading) {
    return <SafeAreaView style={styles.container} />;
  }

  const enabled = sortByStatOrder(teamEnabledStats(team));
  const totals = totalsByPlayer(events, team.players.length);
  const teamPts = totals.reduce((s, t) => s + pointsFromTotals(t), 0);
  const lastEvent = events[events.length - 1];
  const color = team.color;
  const selectedTotals = selected !== null ? totals[selected] : null;
  const dressed = team.players.map((p, i) => ({ p, i })).filter(({ p }) => p.name || p.number);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.teamName, { color }]} numberOfLines={1}>{team.name}</Text>
          <View style={styles.oppRow}>
            <Text style={styles.oppLabel}>vs.</Text>
            <TextInput
              style={styles.oppInput}
              value={opponent}
              onChangeText={changeOpponent}
              placeholder="opponent (optional)"
              placeholderTextColor="#444"
            />
          </View>
        </View>
        <TouchableOpacity style={styles.pauseBtn} onPress={() => router.back()}>
          <Text style={styles.pauseBtnText}>⏸{'\n'}PAUSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={endGame}>
          <Text style={styles.endBtnText}>END{'\n'}GAME</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreBar}>
        <Text style={[styles.scorePoints, { color }]}>{teamPts}</Text>
        <Text style={styles.scoreLabel}>TEAM PTS</Text>
        {selected !== null && selectedTotals && (
          <>
            <View style={styles.scoreDivider} />
            <Text style={[styles.scorePoints, styles.scorePointsSm, { color }]}>{pointsFromTotals(selectedTotals)}</Text>
            <Text style={styles.scoreLabel} numberOfLines={1}>
              #{team.players[selected].number || '?'}
            </Text>
          </>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
      >
        {dressed.map(({ p, i }) => {
          const on = selected === i;
          const isOut = out.includes(i);
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.chip,
                { borderColor: isOut ? '#3D2800' : color },
                on && { backgroundColor: color },
                isOut && styles.chipOut,
              ]}
              onPress={() => !isOut && setSelected(on ? null : i)}
              onLongPress={() => toggleOut(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipNumber, { color: on ? '#0D0700' : isOut ? '#555' : color }]}>
                {p.number || '?'}
              </Text>
              <Text style={[styles.chipName, on && { color: '#0D0700' }, isOut && { color: '#555' }]} numberOfLines={1}>
                {isOut ? 'OUT' : (p.name.split(' ')[0] || 'Player')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {enabled.map(key => {
          const negative = STAT_DEFS[key].negative;
          const count = selectedTotals ? selectedTotals[key] : null;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tile, negative && styles.tileNegative, selected === null && styles.tileIdle]}
              onPress={() => tap(key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.tileCount, { color: selected === null ? '#3D2800' : color }]}>
                {count ?? '–'}
              </Text>
              <Text style={[styles.tileLabel, negative && styles.tileLabelNegative]}>
                {STAT_DEFS[key].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        style={[styles.undoBar, events.length === 0 && styles.undoBarDisabled]}
        onPress={events.length > 0 ? undo : undefined}
        activeOpacity={0.7}
      >
        <Text style={[styles.undoText, events.length === 0 && styles.undoTextDisabled]} numberOfLines={1}>
          {lastEvent
            ? `⟵ UNDO #${team.players[lastEvent.player]?.number || '?'} ${STAT_DEFS[lastEvent.key].label}`
            : selected === null ? 'TAP A PLAYER, THEN A STAT' : 'TAP A STAT TO START'}
        </Text>
      </TouchableOpacity>

      <ScorePrompt
        visible={showScorePrompt}
        accent={color}
        hint="From the gym scoreboard — the box score and team record need it."
        onSubmit={score => { if (score) finish(score); }}
        onCancel={() => setShowScorePrompt(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: '#8B6914',
  },
  teamName: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  oppRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  oppLabel: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  oppInput: { color: '#C8A040', fontSize: 12, fontWeight: '600', padding: 0, flex: 1 },
  pauseBtn: {
    backgroundColor: '#0D0700', borderWidth: 1, borderColor: '#3D2800',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  pauseBtnText: { color: '#8B6914', fontSize: 11, fontWeight: '900', letterSpacing: 1, textAlign: 'center', lineHeight: 15 },
  endBtn: {
    backgroundColor: '#3D2800', borderWidth: 1, borderColor: '#8B6914',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  endBtnText: { color: '#C8A040', fontSize: 11, fontWeight: '900', letterSpacing: 1, textAlign: 'center', lineHeight: 15 },
  scoreBar: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    gap: 10, paddingVertical: 8, backgroundColor: '#0D0700',
    borderBottomWidth: 1, borderBottomColor: '#2A1A00',
  },
  scorePoints: { fontSize: 36, fontWeight: '900' },
  scorePointsSm: { fontSize: 24 },
  scoreLabel: { color: '#8B6914', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  scoreDivider: { width: 1, height: 22, backgroundColor: '#3D2800', marginHorizontal: 8, alignSelf: 'center' },
  strip: { flexGrow: 0, backgroundColor: '#0D0700', borderBottomWidth: 1, borderBottomColor: '#2A1A00' },
  stripContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    width: 64, height: 64, borderRadius: 10, borderWidth: 2,
    backgroundColor: '#1A0F00', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  chipOut: { opacity: 0.5 },
  chipNumber: { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  chipName: { color: '#AAA', fontSize: 9, fontWeight: '600', marginTop: 1 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center',
  },
  tile: {
    width: '48%', aspectRatio: 1.8,
    backgroundColor: '#0D0700', borderRadius: 12,
    borderWidth: 2, borderColor: '#3D2800',
    justifyContent: 'center', alignItems: 'center',
  },
  tileIdle: { opacity: 0.6 },
  tileNegative: { borderColor: '#6B1F1F' },
  tileCount: { fontSize: 30, fontWeight: '900' },
  tileLabel: { color: '#C8A040', fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  tileLabelNegative: { color: '#C25E5E' },
  undoBar: {
    backgroundColor: '#0D0700', borderTopWidth: 1, borderTopColor: '#3D2800',
    paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center',
  },
  undoBarDisabled: { borderTopColor: '#2A1A00' },
  undoText: { color: '#C8A040', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  undoTextDisabled: { color: '#444' },
});
