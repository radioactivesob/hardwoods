import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKidStats } from '../hooks/useKidStats';
import ScorePrompt from '../components/ScorePrompt';
import { STAT_DEFS, StatEvent, StatKey, totalsFromEvents, pointsFromTotals, sortByStatOrder, kidColor } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

// In-progress game survives app restarts — a parent at a real game
// can't afford to lose 3 quarters of taps to a dead battery moment.
import { IN_PROGRESS_KEY } from '../hooks/useKidStats';
import { FloorStint, floorSeconds, formatClock } from '../hooks/kidStats';

interface InProgressGame {
  kidId: string;
  opponent: string;
  startedAt: number;
  events: StatEvent[];
  /** Playing-time stints; the last one is open while she's on the floor. */
  floor?: FloorStint[];
  /** Wall time the game spent paused (screen left), so it doesn't count. */
  pausedSec?: number;
  /** Written on every persist and by a heartbeat while she's on the floor,
   *  so a crash mid-stint can still be closed at roughly the right moment. */
  lastSeen?: number;
}

const HEARTBEAT_MS = 20000;

export default function KidGame() {
  useAllOrientations();
  // A parent tracks for a whole game with long gaps between taps —
  // the screen must not auto-lock mid-game. Released on unmount.
  useKeepAwake();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId: string }>();
  const { profiles, saveGame } = useKidStats();
  const profile = profiles.find(p => p.id === kidId) ?? null;

  const [events, setEvents] = useState<StatEvent[]>([]);
  const [opponent, setOpponent] = useState('');
  const [startedAt, setStartedAt] = useState(Date.now());
  const [restored, setRestored] = useState(false);
  const [showScorePrompt, setShowScorePrompt] = useState(false);
  const [floor, setFloor] = useState<FloorStint[]>([]);
  const [pausedSec, setPausedSec] = useState(0);
  const [tick, setTick] = useState(0); // re-render for the running clock

  const onFloor = floor.length > 0 && floor[floor.length - 1].out === undefined;

  useEffect(() => {
    AsyncStorage.getItem(IN_PROGRESS_KEY).then(raw => {
      if (raw) {
        const saved: InProgressGame = JSON.parse(raw);
        // A game with a floor stint but no taps yet is still a game in
        // progress — she can be on the floor before her first stat.
        if (saved.kidId === kidId && (saved.events.length > 0 || (saved.floor?.length ?? 0) > 0)) {
          setEvents(saved.events);
          setOpponent(saved.opponent);
          setStartedAt(saved.startedAt);
          // Time away (pause, or a crash) doesn't count toward the game, and
          // an open stint is closed at the last moment we know she was on.
          const now = Date.now();
          const seen = saved.lastSeen ?? now;
          setPausedSec((saved.pausedSec ?? 0) + Math.max(0, (now - seen) / 1000));
          const stints = saved.floor ?? [];
          const last = stints[stints.length - 1];
          if (last && last.out === undefined) {
            // She was on when we left; close that stint at lastSeen and open
            // a fresh one now, so the gap is neither played nor lost.
            setFloor([...stints.slice(0, -1), { ...last, out: Math.max(last.in, seen) }, { in: now }]);
          } else {
            setFloor(stints);
          }
        }
      }
      setRestored(true);
    });
  }, [kidId]);

  const persist = useCallback((next: StatEvent[], opp: string, stints: FloorStint[] = floor, paused = pausedSec) => {
    const snapshot: InProgressGame = {
      kidId: kidId!, opponent: opp, startedAt, events: next,
      floor: stints, pausedSec: paused, lastSeen: Date.now(),
    };
    AsyncStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(snapshot));
  }, [kidId, startedAt, floor, pausedSec]);

  // While she's on the floor: tick the clock every second and refresh
  // lastSeen every HEARTBEAT_MS so a dead battery loses at most 20s.
  useEffect(() => {
    if (!onFloor || !restored) return;
    const clock = setInterval(() => setTick(t => t + 1), 1000);
    const beat = setInterval(() => persist(events, opponent), HEARTBEAT_MS);
    return () => { clearInterval(clock); clearInterval(beat); };
  }, [onFloor, restored, persist, events, opponent]);

  // Leaving the screen (PAUSE) stamps lastSeen, which is what the restore
  // path uses to stop the clock for the time away. Read through a ref so
  // the unmount cleanup sees the latest taps, not the ones from mount —
  // persisting a stale snapshot here would silently drop stats.
  const latest = useRef({ events, opponent, floor, pausedSec });
  latest.current = { events, opponent, floor, pausedSec };
  // Set once the game is saved or discarded, so the cleanup below doesn't
  // resurrect it as in-progress on the way out.
  const finished = useRef(false);
  useEffect(() => {
    if (!restored) return;
    return () => {
      if (finished.current) return;
      const l = latest.current;
      const snapshot: InProgressGame = {
        kidId: kidId!, opponent: l.opponent, startedAt, events: l.events,
        floor: l.floor, pausedSec: l.pausedSec, lastSeen: Date.now(),
      };
      // Nothing to keep if the parent never tapped anything or used the toggle.
      if (l.events.length === 0 && l.floor.length === 0) return;
      AsyncStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(snapshot));
    };
  }, [restored, kidId, startedAt]);

  const toggleFloor = () => {
    const now = Date.now();
    const next = onFloor
      ? [...floor.slice(0, -1), { ...floor[floor.length - 1], out: now }]
      : [...floor, { in: now }];
    setFloor(next);
    persist(events, opponent, next);
  };

  const tap = (key: StatKey) => {
    setEvents(prev => {
      const next = [...prev, { key, at: Date.now() }];
      persist(next, opponent);
      return next;
    });
  };

  const undo = () => {
    setEvents(prev => {
      const next = prev.slice(0, -1);
      persist(next, opponent);
      return next;
    });
  };

  const changeOpponent = (v: string) => {
    setOpponent(v);
    persist(events, v);
  };

  const endGame = () => {
    if (events.length === 0) {
      Alert.alert('Nothing Tracked', 'No stats recorded yet. Leave without saving?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => { finished.current = true; AsyncStorage.removeItem(IN_PROGRESS_KEY); router.back(); } },
      ]);
      return;
    }
    const totals = totalsFromEvents(events);
    const pts = pointsFromTotals(totals);
    Alert.alert(
      'End Game?',
      `Save this game for ${profile?.name}? (${pts} point${pts === 1 ? '' : 's'}, ${events.length} stat${events.length === 1 ? '' : 's'} recorded)`,
      [
        { text: 'Keep Tracking', style: 'cancel' },
        {
          text: 'Save Game',
          // The final score is on the gym scoreboard right now — one
          // optional prompt, then straight to the share card.
          onPress: () => setShowScorePrompt(true),
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Discard Game?', 'All taps from this game will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => { finished.current = true; AsyncStorage.removeItem(IN_PROGRESS_KEY); router.back(); } },
            ]);
          },
        },
      ],
    );
  };

  if (!profile || !restored) {
    return <SafeAreaView style={styles.container} />;
  }

  const totals = totalsFromEvents(events);
  const points = pointsFromTotals(totals);
  const lastEvent = events[events.length - 1];
  const accent = kidColor(profile);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kidName}>
            {profile.number ? `#${profile.number} ` : ''}{profile.name}
          </Text>
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
        <TouchableOpacity
          style={styles.pauseBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.pauseBtnText}>⏸{'\n'}PAUSE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.endBtn} onPress={endGame}>
          <Text style={styles.endBtnText}>END{'\n'}GAME</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreBar}>
        <Text style={[styles.scorePoints, { color: accent }]}>{points}</Text>
        <Text style={styles.scoreLabel}>POINTS</Text>
      </View>

      {/* Playing time. Optional — the tiles work whether or not this is used,
          so forgetting it costs minutes, never stats. */}
      <TouchableOpacity
        style={[styles.floorBtn, onFloor ? { backgroundColor: accent, borderColor: accent } : styles.floorBtnOff]}
        onPress={toggleFloor}
        activeOpacity={0.8}
      >
        <Text style={[styles.floorText, onFloor ? { color: '#1A0F00' } : { color: '#8B6914' }]}>
          {onFloor ? '● ON THE FLOOR' : '○ ON THE BENCH'}
        </Text>
        <Text style={[styles.floorClock, onFloor ? { color: '#1A0F00' } : { color: '#555' }]}>
          {formatClock(floorSeconds(floor))}
          {onFloor ? '' : floor.length === 0 ? '  ·  tap when she checks in' : '  ·  tap when she checks back in'}
        </Text>
      </TouchableOpacity>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {sortByStatOrder(profile.enabledStats).map(key => {
          const negative = STAT_DEFS[key].negative;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tile, negative && styles.tileNegative]}
              onPress={() => tap(key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.tileCount, { color: accent }]}>{totals[key]}</Text>
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
        <Text style={[styles.undoText, events.length === 0 && styles.undoTextDisabled]}>
          {lastEvent ? `⟵ UNDO ${STAT_DEFS[lastEvent.key].label}` : 'TAP A STAT TO START'}
        </Text>
      </TouchableOpacity>
      <ScorePrompt
        visible={showScorePrompt}
        accent={accent}
        skipLabel="SKIP — SAVE WITHOUT SCORE"
        onSubmit={score => {
          setShowScorePrompt(false);
          // End Game closes an open stint — forgetting to tap OUT at the
          // buzzer is the normal case, not an error.
          const endedAt = Date.now();
          const closed = onFloor
            ? [...floor.slice(0, -1), { ...floor[floor.length - 1], out: endedAt }]
            : floor;
          const game = saveGame(kidId!, events, {
            opponent, date: startedAt, teamScore: score ?? undefined,
            floor: closed,
            durationSec: Math.max(0, (endedAt - startedAt) / 1000 - pausedSec),
          });
          finished.current = true; AsyncStorage.removeItem(IN_PROGRESS_KEY);
          router.replace({ pathname: '/kidshare', params: { kidId: kidId!, gameId: game.id } });
        }}
      />
    </SafeAreaView>
  );
}

const TILE_GAP = 10;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: '#8B6914',
  },
  kidName: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  oppRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  oppLabel: { color: '#666', fontSize: 12, fontStyle: 'italic' },
  oppInput: {
    color: '#C8A040', fontSize: 12, fontWeight: '600', padding: 0, flex: 1,
  },
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
    gap: 10, paddingVertical: 12, backgroundColor: '#0D0700',
    borderBottomWidth: 1, borderBottomColor: '#2A1A00',
  },
  scorePoints: { color: '#FF8A1F', fontSize: 44, fontWeight: '900' },
  scoreLabel: { color: '#8B6914', fontSize: 13, fontWeight: '700', letterSpacing: 3 },
  floorBtn: {
    marginHorizontal: 16, marginTop: 12, borderRadius: 10, borderWidth: 2,
    paddingVertical: 10, alignItems: 'center', maxWidth: 528, width: '92%', alignSelf: 'center',
  },
  floorBtnOff: { backgroundColor: '#0D0700', borderColor: '#3D2800' },
  floorText: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  floorClock: { fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP,
    padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center',
  },
  tile: {
    width: `48%`,
    aspectRatio: 1.6,
    backgroundColor: '#0D0700', borderRadius: 12,
    borderWidth: 2, borderColor: '#3D2800',
    justifyContent: 'center', alignItems: 'center',
  },
  tileNegative: { borderColor: '#6B1F1F' },
  tileCount: { color: '#FF8A1F', fontSize: 34, fontWeight: '900' },
  tileLabel: { color: '#C8A040', fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  tileLabelNegative: { color: '#C25E5E' },
  undoBar: {
    backgroundColor: '#0D0700', borderTopWidth: 1, borderTopColor: '#3D2800',
    paddingVertical: 16, alignItems: 'center',
  },
  undoBarDisabled: { borderTopColor: '#2A1A00' },
  undoText: { color: '#C8A040', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  undoTextDisabled: { color: '#444' },
});
