import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamGames, ArchivedPlayer } from '../hooks/useTeamGames';
import { useTeamLibrary } from '../hooks/useTeamLibrary';
import {
  STAT_DEFS, StatKey, StatEvent, emptyTotals, pointsFromTotals, sortByStatOrder,
} from '../hooks/kidStats';
import { byJersey, playerStatsFromTotals, teamEnabledStats } from '../hooks/teamStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Rebuild a tap log from counts, the way manual entry does. */
function eventsFromTotals(totals: Record<StatKey, number>, at: number): StatEvent[] {
  const events: StatEvent[] = [];
  let t = at;
  (Object.keys(totals) as StatKey[]).forEach(key => {
    for (let i = 0; i < totals[key]; i++) {
      t += 1000;
      events.push({ key, at: t });
    }
  });
  return events;
}

/**
 * Fix a Team Stats game after the fact. Two things go wrong at a real game:
 * a line is recorded under the wrong girl, and a tap is missed or doubled.
 * Reassigning moves the whole line; the steppers adjust counts. Either way
 * the archived line is rebuilt from totals so it stays consistent with a
 * live-tracked one.
 */
export default function TeamStatsEdit() {
  useAllOrientations();
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { games, loading, updateGame } = useTeamGames();
  const { library } = useTeamLibrary();
  const [open, setOpen] = useState<number | null>(null);

  const game = games.find(g => g.id === gameId) ?? null;
  if (loading || !game) return <SafeAreaView style={styles.container} />;

  const us = game.teamA;
  const color = us.color;
  const players = us.players.map((p, i) => ({ ...p, i })).sort(byJersey);
  // The saved team knows who *could* have played, including anyone who was
  // marked out or never tapped — that's the list a misattributed line moves to.
  const saved = library.find(t => t.name.trim().toLowerCase() === us.name.trim().toLowerCase());
  const enabled = sortByStatOrder(teamEnabledStats(saved ?? {}));

  const rewrite = (idx: number, fn: (p: ArchivedPlayer) => ArchivedPlayer | null) => {
    updateGame(game.id, g => ({
      ...g,
      teamA: {
        ...g.teamA,
        players: g.teamA.players
          .map((p, i) => (i === idx ? fn(p) : p))
          .filter((p): p is ArchivedPlayer => p !== null),
      },
    }));
  };

  const setLine = (idx: number, totals: Record<StatKey, number>) => {
    rewrite(idx, p => ({
      ...p,
      totals,
      stats: playerStatsFromTotals(totals),
      events: eventsFromTotals(totals, game.date),
    }));
  };

  const bump = (idx: number, key: StatKey, delta: number) => {
    const p = us.players[idx];
    const totals = { ...emptyTotals(), ...(p.totals ?? {}) };
    totals[key] = Math.max(0, (totals[key] ?? 0) + delta);
    setLine(idx, totals);
  };

  const reassign = (idx: number) => {
    const from = us.players[idx];
    const inGame = new Set(us.players.map(p => `${p.number}|${p.name}`.toLowerCase()));
    // Candidates: everyone on the saved roster who isn't already a line in
    // this game, plus anyone in the game with an empty line to absorb it.
    const roster = (saved?.players ?? []).map((p, i) => ({ ...p, i })).sort(byJersey);
    const options = roster.filter(r =>
      !inGame.has(`${r.number}|${r.name}`.toLowerCase()) ||
      us.players.some(p => p.name === r.name && p.number === r.number && p.stats.points === 0 && p.stats.fouls === 0 && p.stats.fgAttempted === 0),
    ).filter(r => !(r.name === from.name && r.number === from.number));

    if (options.length === 0) {
      Alert.alert('Nobody to Move To', 'Everyone on the roster already has a line in this game.');
      return;
    }
    Alert.alert(
      `Move #${from.number || '?'} ${from.name}'s line`,
      'These stats were actually…',
      [
        { text: 'Cancel', style: 'cancel' },
        ...options.map(to => ({
          text: `#${to.number || '?'} ${to.name}`,
          onPress: () => {
            const target = us.players.findIndex(p => p.name === to.name && p.number === to.number);
            if (target >= 0) {
              // She already has an (empty) line — move the stats onto it and
              // drop the line they came from.
              const totals = { ...emptyTotals(), ...(from.totals ?? {}) };
              updateGame(game.id, g => ({
                ...g,
                teamA: {
                  ...g.teamA,
                  players: g.teamA.players
                    .map((p, i) => i === target
                      ? { ...p, totals, stats: playerStatsFromTotals(totals), events: eventsFromTotals(totals, g.date) }
                      : p)
                    .filter((_, i) => i !== idx),
                },
              }));
            } else {
              rewrite(idx, p => ({ ...p, name: to.name, number: to.number }));
            }
            setOpen(null);
          },
        })),
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← DONE</Text>
        </TouchableOpacity>
        <Text style={styles.title}>EDIT STATS</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.gameTitle, { color }]}>{us.name}</Text>
        <Text style={styles.gameMeta}>
          {game.finalA} — {game.finalB} vs. {game.teamB.name} · {formatDate(game.date)}
        </Text>
        <Text style={styles.intro}>
          Tap a player to adjust her line, or move it to whoever it should have
          been under. Changes save as you go.
        </Text>

        {players.map(p => {
          const idx = p.i;
          const isOpen = open === idx;
          const totals = { ...emptyTotals(), ...(p.totals ?? {}) };
          const pts = pointsFromTotals(totals);
          return (
            <View key={`${p.number}-${p.name}-${idx}`} style={[styles.row, isOpen && { borderColor: color }]}>
              <TouchableOpacity style={styles.rowHead} onPress={() => setOpen(isOpen ? null : idx)} activeOpacity={0.7}>
                <Text style={[styles.rowNumber, { color }]}>#{p.number || '?'}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.rowPts}>{pts} pts</Text>
                <Text style={styles.rowChevron}>{isOpen ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.detail}>
                  <TouchableOpacity style={styles.moveBtn} onPress={() => reassign(idx)}>
                    <Text style={styles.moveBtnText}>↪ THIS WAS ACTUALLY SOMEONE ELSE</Text>
                  </TouchableOpacity>
                  {enabled.map(key => {
                    const def = STAT_DEFS[key];
                    const n = totals[key] ?? 0;
                    return (
                      <View key={key} style={[styles.statRow, def.negative && styles.statRowNegative]}>
                        <Text style={[styles.statLabel, def.negative && { color: '#C25E5E' }]}>{def.label}</Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={[styles.stepBtn, n === 0 && styles.stepBtnOff]}
                            onPress={() => bump(idx, key, -1)}
                          >
                            <Text style={styles.stepBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={[styles.stepValue, { color: n > 0 ? color : '#555' }]}>{n}</Text>
                          <TouchableOpacity style={styles.stepBtn} onPress={() => bump(idx, key, 1)}>
                            <Text style={styles.stepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 30 }} />
      </ScrollView>
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
  gameTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  gameMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  intro: { color: '#8B6914', fontSize: 12, lineHeight: 17, marginTop: 10, marginBottom: 14 },
  row: {
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    marginBottom: 8, overflow: 'hidden',
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  rowNumber: { fontSize: 15, fontWeight: '900', width: 40 },
  rowName: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1 },
  rowPts: { color: '#888', fontSize: 12, fontWeight: '700' },
  rowChevron: { color: '#8B6914', fontSize: 14, width: 14, textAlign: 'right' },
  detail: { borderTopWidth: 1, borderTopColor: '#2A1A00', padding: 12 },
  moveBtn: {
    borderWidth: 1, borderColor: '#8B6914', borderRadius: 6, paddingVertical: 9,
    alignItems: 'center', marginBottom: 10,
  },
  moveBtnText: { color: '#C8A040', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  statRowNegative: {},
  statLabel: { color: '#C8A040', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: {
    width: 38, height: 34, borderRadius: 6, backgroundColor: '#2A1A00',
    justifyContent: 'center', alignItems: 'center',
  },
  stepBtnOff: { opacity: 0.35 },
  stepBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  stepValue: { fontSize: 17, fontWeight: '900', minWidth: 34, textAlign: 'center' },
});
