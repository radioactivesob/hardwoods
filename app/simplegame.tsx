import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLandscapeOnly } from '../hooks/useScreenOrientation';

const STORAGE_KEY = 'hardwoods_simple_inprogress';
const MAX_PERIODS = 6;

type TeamId = 'A' | 'B';
type EventKind = 'points2' | 'points3' | 'ft' | 'foul' | 'tech' | 'timeout';

interface SimpleEvent {
  team: TeamId;
  kind: EventKind;
  period: number;
  at: number;
}

interface SimpleGame {
  nameA: string;
  nameB: string;
  period: number;
  events: SimpleEvent[];
}

const FRESH: SimpleGame = { nameA: 'HOME', nameB: 'GUEST', period: 1, events: [] };

const EVENT_LABEL: Record<EventKind, string> = {
  points2: '+2', points3: '+3', ft: 'FT +1',
  foul: 'FOUL', tech: 'TECH', timeout: 'T.O.',
};

const POINTS: Record<EventKind, number> = {
  points2: 2, points3: 3, ft: 1, foul: 0, tech: 0, timeout: 0,
};

const TEAM_COLORS: Record<TeamId, string> = { A: '#1E90FF', B: '#FF6600' };

export default function SimpleGame() {
  useLandscapeOnly();
  useKeepAwake();
  const router = useRouter();
  const screenRef = useRef<View>(null);
  const [game, setGame] = useState<SimpleGame>(FRESH);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setGame(JSON.parse(raw));
      setRestored(true);
    });
  }, []);

  const update = useCallback((fn: (prev: SimpleGame) => SimpleGame) => {
    setGame(prev => {
      const next = fn(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const record = (team: TeamId, kind: EventKind) => {
    update(prev => ({
      ...prev,
      events: [...prev.events, { team, kind, period: prev.period, at: Date.now() }],
    }));
  };

  const undo = () => {
    update(prev => ({ ...prev, events: prev.events.slice(0, -1) }));
  };

  const advancePeriod = () => {
    update(prev => ({ ...prev, period: Math.min(prev.period + 1, MAX_PERIODS) }));
  };

  const score = (team: TeamId) =>
    game.events.filter(e => e.team === team).reduce((s, e) => s + POINTS[e.kind], 0);

  const periodFouls = (team: TeamId) =>
    game.events.filter(e => e.team === team && e.period === game.period && (e.kind === 'foul' || e.kind === 'tech')).length;

  const timeoutsUsed = (team: TeamId) =>
    game.events.filter(e => e.team === team && e.kind === 'timeout').length;

  const shareResult = async () => {
    try {
      const uri = await captureRef(screenRef, { format: 'jpg', quality: 0.95 });
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share Final Score' });
    } catch {
      Alert.alert('Share Failed', 'Could not create the image. Try again.');
    }
  };

  const newGame = () => {
    Alert.alert('New Game?', 'Current score and events will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'New Game',
        style: 'destructive',
        onPress: () => update(() => ({ ...FRESH })),
      },
    ]);
  };

  const endGame = () => {
    Alert.alert(
      'End Game',
      `Final: ${game.nameA} ${score('A')} — ${score('B')} ${game.nameB}`,
      [
        { text: 'Keep Scoring', style: 'cancel' },
        { text: 'Share Result', onPress: shareResult },
        {
          text: 'Done — Clear Game',
          style: 'destructive',
          onPress: () => {
            AsyncStorage.removeItem(STORAGE_KEY);
            setGame({ ...FRESH });
            router.back();
          },
        },
      ],
    );
  };

  if (!restored) return <SafeAreaView style={styles.container} />;

  const lastEvent = game.events[game.events.length - 1];

  const teamPanel = (team: TeamId) => {
    const name = team === 'A' ? game.nameA : game.nameB;
    const color = TEAM_COLORS[team];
    return (
      <View style={[styles.panel, { borderColor: color }]}>
        <TextInput
          style={[styles.teamName, { color }]}
          value={name}
          onChangeText={v => update(prev => (team === 'A' ? { ...prev, nameA: v } : { ...prev, nameB: v }))}
          maxLength={14}
        />
        <Text style={[styles.score, { color }]}>{score(team)}</Text>
        <Text style={styles.meta}>
          FOULS (Q{game.period}): {periodFouls(team)}   ·   T.O. USED: {timeoutsUsed(team)}
        </Text>
        <View style={styles.btnGrid}>
          {(Object.keys(EVENT_LABEL) as EventKind[]).map(kind => (
            <TouchableOpacity
              key={kind}
              style={[styles.eventBtn, { borderColor: POINTS[kind] > 0 ? color : '#3D2800' }]}
              onPress={() => record(team, kind)}
              activeOpacity={0.6}
            >
              <Text
                style={[styles.eventBtnText, { color: POINTS[kind] > 0 ? color : '#C8A040' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {EVENT_LABEL[kind]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View ref={screenRef} collapsable={false} style={styles.captureArea}>
        <View style={styles.main}>
          {teamPanel('A')}

          <View style={styles.centerCol}>
            <Text style={styles.brand}>HARDWOODS</Text>
            <Text style={styles.periodLabel}>PERIOD</Text>
            <Text style={styles.periodValue}>Q{game.period}</Text>
            {game.period < MAX_PERIODS && (
              <TouchableOpacity style={styles.periodBtn} onPress={advancePeriod}>
                <Text style={styles.periodBtnText}>Q{game.period + 1} →</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.centerBtn} onPress={endGame}>
              <Text style={styles.centerBtnText}>■ END GAME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.centerBtn} onPress={newGame}>
              <Text style={[styles.centerBtnText, { color: '#FF6B6B' }]}>↺ NEW</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.centerBtn} onPress={() => router.back()}>
              <Text style={styles.centerBtnText}>⌂ HOME</Text>
            </TouchableOpacity>
          </View>

          {teamPanel('B')}
        </View>

        <TouchableOpacity
          style={styles.undoBar}
          onPress={game.events.length > 0 ? undo : undefined}
          activeOpacity={0.7}
        >
          <Text style={[styles.undoText, game.events.length === 0 && { color: '#444' }]}>
            {lastEvent
              ? `⟵ UNDO ${lastEvent.team === 'A' ? game.nameA : game.nameB} ${EVENT_LABEL[lastEvent.kind]}`
              : 'TAP AN EVENT TO START'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  captureArea: { flex: 1, backgroundColor: '#1A0F00' },
  main: { flex: 1, flexDirection: 'row', padding: 10, gap: 10 },
  panel: {
    flex: 1, borderWidth: 2, borderRadius: 14, backgroundColor: '#0D0700',
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
  },
  teamName: {
    fontSize: 16, fontWeight: '900', letterSpacing: 2, textAlign: 'center',
    padding: 0, minWidth: 120,
  },
  score: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  meta: { color: '#8B6914', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  btnGrid: {
    flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center', alignContent: 'stretch', width: '100%',
  },
  eventBtn: {
    width: '30%', flexGrow: 1, minHeight: 44,
    borderWidth: 1.5, borderRadius: 10, backgroundColor: '#1A0F00',
    justifyContent: 'center', alignItems: 'center',
  },
  eventBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 1 },
  centerCol: { width: 120, alignItems: 'center', paddingVertical: 6 },
  brand: { color: '#5A4210', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  periodLabel: { color: '#8B6914', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  periodValue: { color: '#C8A040', fontSize: 30, fontWeight: '900' },
  periodBtn: {
    backgroundColor: '#8B6914', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
    marginTop: 6,
  },
  periodBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  centerBtn: { paddingVertical: 7 },
  centerBtnText: { color: '#C8A040', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  undoBar: {
    backgroundColor: '#0D0700', borderTopWidth: 1, borderTopColor: '#3D2800',
    paddingVertical: 12, alignItems: 'center',
  },
  undoText: { color: '#C8A040', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
