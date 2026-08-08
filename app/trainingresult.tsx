import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  Alert, useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Court from '../components/Court';
import { useKidStats } from '../hooks/useKidStats';
import { useTraining } from '../hooks/useTraining';
import {
  SPOTS, sessionLine, zoneLines, formatPct, targetMet, Session, Line,
} from '../hooks/trainingStats';
import { kidColor } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function TrainingResult() {
  useAllOrientations();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profiles } = useKidStats();
  const { sessions, sessionsForKid, findDrill, deleteSession } = useTraining();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const session: Session | null = sessions.find(s => s.id === sessionId) ?? null;
  const profile = profiles.find(p => p.id === session?.kidId) ?? null;

  if (!session || !profile) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const drill = findDrill(session.drillId);
  const line = sessionLine(session.shots);
  const met = targetMet(session.shots, session.target);

  // Compare against the last time she ran this same drill — comparing a
  // three-point drill against a layup drill would be noise.
  const prior = sessionsForKid(session.kidId)
    .filter(s => s.date < session.date && s.drillId === session.drillId && s.shots.length > 0)
    .pop();
  const priorPct = prior ? sessionLine(prior.shots).pct : null;
  const delta = priorPct != null && line.pct != null ? line.pct - priorPct : null;

  // Drills break down by step (a drill can hit one spot twice); open gym
  // has no steps, so it breaks down by court zone.
  const rows: { label: string; line: Line; of?: number }[] = drill
    ? drill.steps.map((st, i) => ({
        label: SPOTS[st.spotId]?.label ?? st.spotId,
        line: sessionLine(session.shots.filter(s => s.stepIndex === i)),
        of: st.attempts,
      }))
    : zoneLines(session.shots).map(z => ({ label: z.zone.label, line: z.line }));

  // One marker per distinct spot in the drill, merging steps that revisit it.
  const spotMarkers = drill
    ? Object.values(
        drill.steps.reduce((acc, st, i) => {
          const spot = SPOTS[st.spotId];
          if (!spot) return acc;
          const l = sessionLine(session.shots.filter(s => s.stepIndex === i));
          const cur = acc[st.spotId] ?? { spot, made: 0, attempted: 0 };
          cur.made += l.made;
          cur.attempted += l.attempted;
          acc[st.spotId] = cur;
          return acc;
        }, {} as Record<string, { spot: typeof SPOTS[string]; made: number; attempted: number }>),
      )
    : [];

  const courtWidth = Math.min(width - 72, 360);

  const share = async () => {
    try {
      setSharing(true);
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/jpeg',
          dialogTitle: `${profile.name} — ${drill?.name ?? 'Open gym'}`,
        });
      }
    } catch {
      Alert.alert('Share Failed', 'Could not create the image. Try again.');
    } finally {
      setSharing(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete Session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { deleteSession(session.id); router.back(); },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← DONE</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SESSION</Text>
        <TouchableOpacity onPress={sharing ? undefined : share}>
          <Text style={styles.shareText}>{sharing ? '…' : '📤 SHARE'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <Text style={styles.cardBrand}>HARDWOODS</Text>
          <Text style={[styles.cardName, { color: accent }]}>
            {profile.number ? `#${profile.number}  ` : ''}{profile.name.toUpperCase()}
          </Text>
          <Text style={styles.cardSub}>
            {drill?.name ?? 'Open gym'} · {formatDate(session.date)}
          </Text>

          <View style={styles.headlineRow}>
            <Text style={[styles.headlineValue, { color: accent }]}>{formatPct(line.pct)}</Text>
            <Text style={styles.headlineLabel}>{line.made} of {line.attempted}</Text>
          </View>

          <View style={styles.badgeRow}>
            {met !== null && (
              <View style={[styles.badge, met ? styles.badgeGood : styles.badgeBad]}>
                <Text style={[styles.badgeText, { color: met ? '#7BC67B' : '#C25E5E' }]}>
                  {`TARGET ${formatPct(session.target ?? null)} · ${met ? 'MET' : 'MISSED'}`}
                </Text>
              </View>
            )}
            {delta !== null && (
              <View style={styles.badge}>
                <Text style={[styles.badgeText, { color: delta >= 0 ? '#7BC67B' : '#C25E5E' }]}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}% vs last time
                </Text>
              </View>
            )}
          </View>

          <View style={styles.courtWrap}>
            <Court
              width={courtWidth}
              accent={accent}
              // Drill reps all share their spot's coordinate, so summarise
              // per spot; free-shooting taps are distinct, so plot them.
              shots={drill ? [] : session.shots}
              spotMarkers={drill ? spotMarkers : []}
            />
          </View>

          <Text style={styles.legendText}>
            {drill ? 'shooting % at each spot' : 'filled = made · hollow = missed'}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>{drill ? 'BY SPOT' : 'BY ZONE'}</Text>
          {rows.map((r, i) => (
            <View key={`${r.label}-${i}`} style={styles.row}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>
                {r.line.attempted === 0
                  ? '—'
                  : `${r.line.made}/${r.line.attempted}${r.of && r.line.attempted !== r.of ? ` of ${r.of}` : ''} · ${formatPct(r.line.pct)}`}
              </Text>
            </View>
          ))}

          <Text style={styles.cardFooter}>
            {session.completed ? 'drill completed' : 'practice session'} · Hardwoods
          </Text>
        </View>

        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteText}>DELETE SESSION</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
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
  shareText: { color: '#C8A040', fontSize: 13, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  scroll: { padding: 16, alignItems: 'center' },
  card: {
    backgroundColor: '#120900', borderRadius: 16, borderWidth: 2, borderColor: '#3D2800',
    padding: 20, width: '100%', maxWidth: 440, alignItems: 'center',
  },
  cardBrand: {
    color: '#8B6914', fontSize: 11, fontWeight: '900', letterSpacing: 4, marginBottom: 10,
  },
  cardName: { fontSize: 22, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  cardSub: { color: '#888', fontSize: 12, marginTop: 4, textAlign: 'center' },
  headlineRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 14 },
  headlineValue: { fontSize: 52, fontWeight: '900' },
  headlineLabel: { color: '#8B6914', fontSize: 14, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'center' },
  badge: {
    borderWidth: 1, borderColor: '#3D2800', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#1A0F00',
  },
  badgeGood: { borderColor: '#2F5E2F' },
  badgeBad: { borderColor: '#5E2F2F' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  courtWrap: { marginTop: 18 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  legendDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  legendText: { color: '#8B6914', fontSize: 11, marginRight: 10 },
  divider: { height: 1, backgroundColor: '#2A1A00', alignSelf: 'stretch', marginVertical: 16 },
  sectionLabel: {
    color: '#C8A040', fontSize: 11, fontWeight: '800', letterSpacing: 2,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    alignSelf: 'stretch', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#1F1305',
  },
  rowLabel: { color: '#FFF', fontSize: 13 },
  rowValue: { color: '#C8A040', fontSize: 13, fontWeight: '800' },
  cardFooter: {
    color: '#5A4210', fontSize: 10, fontStyle: 'italic', marginTop: 16, textAlign: 'center',
  },
  deleteBtn: { marginTop: 18, paddingVertical: 10 },
  deleteText: { color: '#7A1A1A', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});
