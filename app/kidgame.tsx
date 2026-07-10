import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  TextInput, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKidStats } from '../hooks/useKidStats';
import { STAT_DEFS, StatEvent, StatKey, totalsFromEvents, pointsFromTotals } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

// In-progress game survives app restarts — a parent at a real game
// can't afford to lose 3 quarters of taps to a dead battery moment.
const IN_PROGRESS_KEY = 'hardwoods_kidgame_inprogress';

interface InProgressGame {
  kidId: string;
  opponent: string;
  startedAt: number;
  events: StatEvent[];
}

export default function KidGame() {
  useAllOrientations();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId: string }>();
  const { profiles, saveGame } = useKidStats();
  const profile = profiles.find(p => p.id === kidId) ?? null;

  const [events, setEvents] = useState<StatEvent[]>([]);
  const [opponent, setOpponent] = useState('');
  const [startedAt, setStartedAt] = useState(Date.now());
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(IN_PROGRESS_KEY).then(raw => {
      if (raw) {
        const saved: InProgressGame = JSON.parse(raw);
        if (saved.kidId === kidId && saved.events.length > 0) {
          setEvents(saved.events);
          setOpponent(saved.opponent);
          setStartedAt(saved.startedAt);
        }
      }
      setRestored(true);
    });
  }, [kidId]);

  const persist = useCallback((next: StatEvent[], opp: string) => {
    const snapshot: InProgressGame = { kidId: kidId!, opponent: opp, startedAt, events: next };
    AsyncStorage.setItem(IN_PROGRESS_KEY, JSON.stringify(snapshot));
  }, [kidId, startedAt]);

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
        { text: 'Leave', onPress: () => { AsyncStorage.removeItem(IN_PROGRESS_KEY); router.back(); } },
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
          onPress: () => {
            saveGame(kidId!, events, { opponent, date: startedAt });
            AsyncStorage.removeItem(IN_PROGRESS_KEY);
            router.back();
          },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Discard Game?', 'All taps from this game will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => { AsyncStorage.removeItem(IN_PROGRESS_KEY); router.back(); } },
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
        <TouchableOpacity style={styles.endBtn} onPress={endGame}>
          <Text style={styles.endBtnText}>END{'\n'}GAME</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreBar}>
        <Text style={styles.scorePoints}>{points}</Text>
        <Text style={styles.scoreLabel}>POINTS</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {profile.enabledStats.map(key => (
          <TouchableOpacity
            key={key}
            style={styles.tile}
            onPress={() => tap(key)}
            activeOpacity={0.6}
          >
            <Text style={styles.tileCount}>{totals[key]}</Text>
            <Text style={styles.tileLabel}>{STAT_DEFS[key].label}</Text>
          </TouchableOpacity>
        ))}
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
  tileCount: { color: '#FF8A1F', fontSize: 34, fontWeight: '900' },
  tileLabel: { color: '#C8A040', fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  undoBar: {
    backgroundColor: '#0D0700', borderTopWidth: 1, borderTopColor: '#3D2800',
    paddingVertical: 16, alignItems: 'center',
  },
  undoBarDisabled: { borderTopColor: '#2A1A00' },
  undoText: { color: '#C8A040', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  undoTextDisabled: { color: '#444' },
});
