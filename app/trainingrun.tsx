import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Court from '../components/Court';
import { useKidStats } from '../hooks/useKidStats';
import { useTraining, TRAINING_IN_PROGRESS_KEY } from '../hooks/useTraining';
import {
  Shot, SPOTS, classifyZone, ZONES, drillProgress, sessionLine, formatPct,
} from '../hooks/trainingStats';
import { kidColor } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

interface InProgress {
  kidId: string;
  drillId?: string;
  startedAt: number;
  shots: Shot[];
}

export default function TrainingRun() {
  useAllOrientations();
  // Rebounding between shots means long gaps without touching the phone.
  useKeepAwake();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { kidId, drillId } = useLocalSearchParams<{ kidId: string; drillId?: string }>();
  const { profiles } = useKidStats();
  const { findDrill, saveSession, targetFor } = useTraining();

  const profile = profiles.find(p => p.id === kidId) ?? null;
  const drill = findDrill(drillId);

  const [shots, setShots] = useState<Shot[]>([]);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [restored, setRestored] = useState(false);
  // Open-gym only: where the next shot will be recorded, chosen by tapping.
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TRAINING_IN_PROGRESS_KEY).then(raw => {
      if (raw) {
        const saved: InProgress = JSON.parse(raw);
        if (saved.kidId === kidId && saved.drillId === drillId && saved.shots.length > 0) {
          setShots(saved.shots);
          setStartedAt(saved.startedAt);
        }
      }
      setRestored(true);
    });
  }, [kidId, drillId]);

  const persist = useCallback((next: Shot[]) => {
    const snap: InProgress = { kidId: kidId!, drillId, startedAt, shots: next };
    AsyncStorage.setItem(TRAINING_IN_PROGRESS_KEY, JSON.stringify(snap));
  }, [kidId, drillId, startedAt]);

  const progress = drill ? drillProgress(shots, drill) : null;
  const activeSpot = progress?.spot ?? null;
  const line = sessionLine(shots);
  const last = shots[shots.length - 1];

  const record = (made: boolean) => {
    // Drill mode takes position from the active spot; open gym from the tap.
    let x: number, y: number, spotId: string | undefined, stepIndex: number | undefined;
    if (drill) {
      if (!activeSpot) return;
      x = activeSpot.x; y = activeSpot.y;
      spotId = activeSpot.id; stepIndex = progress?.stepIndex;
    } else {
      if (!pending) return;
      x = pending.x; y = pending.y;
    }
    const shot: Shot = { made, at: Date.now(), x, y, zoneId: classifyZone(x, y), spotId, stepIndex };
    setShots(prev => {
      const next = [...prev, shot];
      persist(next);
      return next;
    });
    setPending(null);
  };

  const undo = () => {
    setShots(prev => {
      const next = prev.slice(0, -1);
      persist(next);
      return next;
    });
    setPending(null);
  };

  const finish = (auto = false) => {
    if (shots.length === 0) {
      Alert.alert('Nothing Tracked', 'No shots recorded yet. Leave without saving?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => { AsyncStorage.removeItem(TRAINING_IN_PROGRESS_KEY); router.back(); } },
      ]);
      return;
    }
    const l = sessionLine(shots);
    Alert.alert(
      auto ? 'Drill Complete' : 'End Session?',
      `${profile?.name ?? 'She'} shot ${l.made} of ${l.attempted} (${formatPct(l.pct)}).`,
      [
        ...(auto ? [] : [{ text: 'Keep Shooting', style: 'cancel' as const }]),
        {
          text: 'Save Session',
          onPress: () => {
            const s = saveSession(kidId!, shots, {
              drillId: drill?.id,
              drillName: drill?.name,
              // Snapshot the player's target so past sessions keep the bar
              // they were actually judged against.
              target: drill ? targetFor(kidId!, drill) : undefined,
              completed: progress?.complete ?? false,
              date: startedAt,
            });
            AsyncStorage.removeItem(TRAINING_IN_PROGRESS_KEY);
            router.replace({ pathname: '/trainingresult', params: { sessionId: s.id } });
          },
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Discard Session?', 'All shots will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Discard', style: 'destructive', onPress: () => { AsyncStorage.removeItem(TRAINING_IN_PROGRESS_KEY); router.back(); } },
            ]);
          },
        },
      ],
    );
  };

  // Offer to wrap up the moment the last drill rep lands. This effect has to
  // sit above the early return below — hooks can't run conditionally.
  const justCompleted = !!progress?.complete && shots.length === progress.totalAttempts;
  useEffect(() => {
    if (justCompleted && profile) finish(true);
  }, [justCompleted]);

  if (!profile || !restored) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const courtWidth = Math.min(width - 32, 420);
  // Alternating drills (Mikan) revisit the same spots, so draw each spot
  // once, and only call it done when no later step comes back to it.
  const drillSpots = drill
    ? Array.from(new Set(drill.steps.map(s => s.spotId)))
        .map(id => SPOTS[id])
        .filter(Boolean)
    : [];
  const stillToCome = new Set(
    drill ? drill.steps.slice(progress?.stepIndex ?? 0).map(s => s.spotId) : [],
  );
  const completedSpotIds = drillSpots
    .filter(s => !stillToCome.has(s.id))
    .map(s => s.id);
  const canRecord = drill ? !!activeSpot : !!pending;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kidName}>
            {profile.number ? `#${profile.number} ` : ''}{profile.name}
          </Text>
          <Text style={styles.drillName}>{drill ? drill.name : 'Open gym'}</Text>
        </View>
        <TouchableOpacity style={styles.endBtn} onPress={() => finish(false)}>
          <Text style={styles.endBtnText}>END</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.stepLabel}>
        {drill && progress && !progress.complete
          ? `SPOT ${progress.stepIndex + 1} OF ${drill.steps.length} — ${activeSpot?.label.toUpperCase()}`
          : drill
            ? 'DRILL COMPLETE'
            : pending
              ? `RECORDING FROM ${ZONES[classifyZone(pending.x, pending.y)].label.toUpperCase()}`
              : 'TAP THE COURT WHERE SHE SHOT'}
      </Text>

      <View style={styles.courtWrap}>
        <Court
          width={courtWidth}
          spots={drillSpots}
          activeSpotId={activeSpot?.id}
          completedSpotIds={completedSpotIds}
          shots={pending ? [{ made: true, at: 0, x: pending.x, y: pending.y, zoneId: classifyZone(pending.x, pending.y) }] : []}
          accent={pending ? '#FFC93C' : accent}
          onPressPoint={drill ? undefined : (x, y) => setPending({ x, y })}
        />
      </View>

      {drill && progress && !progress.complete && (
        <View style={styles.progressWrap}>
          <Text style={styles.progressText}>
            {/* Single-rep steps (alternating drills) already say which rep
                they're on in the heading — show the whole drill instead. */}
            {progress.attemptsAtStep > 1
              ? `${progress.takenAtStep} OF ${progress.attemptsAtStep} SHOTS`
              : `${progress.totalTaken} OF ${progress.totalAttempts} SHOTS`}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, {
                width: `${(progress.totalTaken / progress.totalAttempts) * 100}%`,
              }]}
            />
          </View>
        </View>
      )}

      {/* A parent who has never run this drill needs to know what it is. */}
      {drill?.description ? (
        <View style={styles.howToWrap}>
          <Text style={styles.howToLabel}>HOW IT WORKS</Text>
          <Text style={styles.howToText}>{drill.description}</Text>
        </View>
      ) : null}

      {/* Push the tap targets into the thumb zone — you hit these without
          looking while she's shooting. */}
      <View style={{ flex: 1 }} />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.makeBtn, !canRecord && styles.btnDisabled]}
          onPress={() => canRecord && record(true)}
          activeOpacity={0.6}
        >
          <Text style={[styles.makeText, !canRecord && styles.textDisabled]}>MAKE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.missBtn, !canRecord && styles.btnDisabled]}
          onPress={() => canRecord && record(false)}
          activeOpacity={0.6}
        >
          <Text style={[styles.missText, !canRecord && styles.textDisabled]}>MISS</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>THIS SESSION</Text>
        <Text style={[styles.footerValue, { color: accent }]}>
          {line.made} / {line.attempted} · {formatPct(line.pct)}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.undoBar}
        onPress={shots.length > 0 ? undo : undefined}
        activeOpacity={0.7}
      >
        <Text style={[styles.undoText, shots.length === 0 && styles.textDisabled]}>
          {last
            ? `⟵ UNDO ${last.made ? 'MAKE' : 'MISS'} — ${ZONES[last.zoneId].label}`
            : 'NO SHOTS YET'}
        </Text>
      </TouchableOpacity>
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
  kidName: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  drillName: { color: '#8B6914', fontSize: 12, fontWeight: '600', marginTop: 2 },
  endBtn: {
    backgroundColor: '#3D2800', borderWidth: 1, borderColor: '#8B6914',
    borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10,
  },
  endBtnText: { color: '#C8A040', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  stepLabel: {
    color: '#C8A040', fontSize: 12, fontWeight: '800', letterSpacing: 1,
    textAlign: 'center', paddingVertical: 12,
  },
  courtWrap: { alignItems: 'center' },
  progressWrap: { paddingHorizontal: 16, paddingTop: 14 },
  progressText: { color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  progressTrack: { height: 7, borderRadius: 3.5, backgroundColor: '#2A1A00' },
  progressFill: { height: 7, borderRadius: 3.5, backgroundColor: '#FFC93C' },
  howToWrap: {
    marginHorizontal: 16, marginTop: 14, padding: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
  },
  howToLabel: { color: '#8B6914', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 5 },
  howToText: { color: '#9A8355', fontSize: 12, lineHeight: 17 },
  buttonRow: { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 18 },
  makeBtn: {
    flex: 1, minHeight: 84, borderRadius: 12, backgroundColor: '#3D2800',
    borderWidth: 2, borderColor: '#FFC93C', justifyContent: 'center', alignItems: 'center',
  },
  missBtn: {
    flex: 1, minHeight: 84, borderRadius: 12, backgroundColor: '#1A0F00',
    borderWidth: 2, borderColor: '#8B3A3A', justifyContent: 'center', alignItems: 'center',
  },
  btnDisabled: { opacity: 0.3 },
  makeText: { color: '#FFC93C', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  missText: { color: '#C25E5E', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  textDisabled: { color: '#444' },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  footerLabel: { color: '#8B6914', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  footerValue: { fontSize: 15, fontWeight: '900' },
  undoBar: {
    backgroundColor: '#0D0700', borderTopWidth: 1, borderTopColor: '#3D2800',
    paddingVertical: 14, alignItems: 'center',
  },
  undoText: { color: '#C8A040', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
