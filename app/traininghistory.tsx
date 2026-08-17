import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
} from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useKidStats } from '../hooks/useKidStats';
import { useTraining } from '../hooks/useTraining';
import {
  sessionLine, zoneLines, formatPct, Session,
} from '../hooks/trainingStats';
import { kidColor } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const ALL = '__all__';
const OPEN_GYM = '__open__';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TrainingHistory() {
  useAllOrientations();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId: string }>();
  const { profiles } = useKidStats();
  const { sessionsForKid, findDrill, reload } = useTraining();
  const [filter, setFilter] = useState<string>(ALL);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const profile = profiles.find(p => p.id === kidId) ?? null;
  if (!profile) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const all = sessionsForKid(profile.id).filter(s => s.shots.length > 0);

  // One chip per drill actually practised, so the list reflects reality
  // rather than every drill that ships with the app.
  const chips: { key: string; label: string }[] = [
    { key: ALL, label: 'ALL' },
    ...Array.from(
      new Map(
        all
          .filter(s => s.drillId)
          .map(s => [s.drillId!, s.drillName ?? findDrill(s.drillId)?.name ?? 'Drill']),
      ).entries(),
    ).map(([key, label]) => ({ key, label })),
    ...(all.some(s => !s.drillId) ? [{ key: OPEN_GYM, label: 'Open gym' }] : []),
  ];

  const sessions: Session[] =
    filter === ALL ? all
      : filter === OPEN_GYM ? all.filter(s => !s.drillId)
        : all.filter(s => s.drillId === filter);

  const shots = sessions.flatMap(s => s.shots);
  const overall = sessionLine(shots);
  const zones = zoneLines(shots);
  const perSession = sessions.map(s => ({ session: s, line: sessionLine(s.shots) }));
  const best = perSession.reduce<typeof perSession[number] | null>(
    (b, x) => (x.line.pct != null && (!b || (b.line.pct ?? 0) < x.line.pct) ? x : b), null);

  // Only meaningful when every session in view shares a target.
  const targets = new Set(sessions.map(s => s.target).filter(t => t != null));
  const target = targets.size === 1 ? [...targets][0]! : null;

  // Improvement: first half of the sessions vs the second half. More stable
  // than first-vs-last, which swings on one good night.
  let trend: number | null = null;
  if (perSession.length >= 4) {
    const half = Math.floor(perSession.length / 2);
    const avg = (xs: typeof perSession) => {
      const made = xs.reduce((n, x) => n + x.line.made, 0);
      const att = xs.reduce((n, x) => n + x.line.attempted, 0);
      return att > 0 ? made / att : null;
    };
    const early = avg(perSession.slice(0, half));
    const late = avg(perSession.slice(-half));
    if (early != null && late != null) trend = late - early;
  }

  const tiles = [
    { label: 'SESSIONS', value: `${sessions.length}` },
    { label: 'SHOTS', value: `${overall.attempted}` },
    { label: 'OVERALL', value: formatPct(overall.pct) },
    ...(best?.line.pct != null ? [{ label: 'BEST', value: formatPct(best.line.pct) }] : []),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {profile.number ? `#${profile.number} ` : ''}{profile.name.toUpperCase()}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      {all.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyHint}>
            Run a drill from {profile.name}'s training screen and the trend starts here.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {chips.length > 1 && (
            <View style={styles.chipRow}>
              {chips.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, filter === c.key && { borderColor: accent, backgroundColor: '#3D2800' }]}
                  onPress={() => setFilter(c.key)}
                >
                  <Text style={[styles.chipText, filter === c.key && { color: accent }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.tileRow}>
            {tiles.map(t => (
              <View key={t.label} style={styles.tile}>
                <Text style={[styles.tileValue, { color: accent }]}>{t.value}</Text>
                <Text style={styles.tileLabel}>{t.label}</Text>
              </View>
            ))}
          </View>

          {trend !== null && (
            <View style={[styles.trendBanner, { borderColor: trend >= 0 ? '#2F5E2F' : '#5E2F2F' }]}>
              <Text style={[styles.trendText, { color: trend >= 0 ? '#7BC67B' : '#C25E5E' }]}>
                {trend >= 0 ? '▲' : '▼'} {Math.abs(Math.round(trend * 100))}% {trend >= 0 ? 'better' : 'lower'} in the second half of these sessions
              </Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>
            SESSION BY SESSION{target != null ? ` · TARGET ${Math.round(target * 100)}%` : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
            <View style={styles.chart}>
              {/* Target line only — its label lives in the heading, where a
                  tall bar can't collide with it. */}
              {target != null && (
                <View style={[styles.targetLine, { bottom: 22 + target * 130 }]} />
              )}
              {perSession.map(({ session, line }) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.col}
                  onPress={() => router.push({ pathname: '/trainingresult', params: { sessionId: session.id } })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.colValue}>{formatPct(line.pct)}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.bar, {
                        backgroundColor: target != null && (line.pct ?? 0) < target ? '#8B3A3A' : accent,
                        height: `${Math.max((line.pct ?? 0) * 100, 2)}%`,
                      }]}
                    />
                  </View>
                  <Text style={styles.colDate}>{formatDate(session.date)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {zones.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>BY ZONE — ALL {sessions.length} SESSION{sessions.length === 1 ? '' : 'S'}</Text>
              {zones.map(z => (
                <View key={z.zone.id} style={styles.row}>
                  <Text style={styles.rowLabel}>{z.zone.label}</Text>
                  <Text style={[styles.rowValue, {
                    color: (z.line.pct ?? 0) < 0.34 ? '#C25E5E' : '#C8A040',
                  }]}>
                    {z.line.made}/{z.line.attempted} · {formatPct(z.line.pct)}
                  </Text>
                </View>
              ))}
            </>
          )}

          <Text style={styles.sectionLabel}>SESSIONS ({sessions.length})</Text>
          {[...perSession].reverse().map(({ session, line }) => (
            <TouchableOpacity
              key={session.id}
              style={styles.sessionRow}
              onPress={() => router.push({ pathname: '/trainingresult', params: { sessionId: session.id } })}
              activeOpacity={0.75}
            >
              <View style={[styles.sessionPct, { borderColor: accent }]}>
                <Text style={[styles.sessionPctText, { color: accent }]}>{formatPct(line.pct)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle}>{session.drillName ?? 'Open gym'}</Text>
                <Text style={styles.sessionMeta}>
                  {formatDate(session.date)} · {line.made}/{line.attempted} shots
                  {session.completed ? ' · completed' : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          <View style={{ height: 24 }} />
        </ScrollView>
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
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scroll: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: '#2A1A00', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#0D0700',
  },
  chipText: { color: '#555', fontSize: 11, fontWeight: '700' },
  tileRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tile: {
    flex: 1, backgroundColor: '#0D0700', borderRadius: 10,
    borderWidth: 1, borderColor: '#2A1A00', paddingVertical: 14, alignItems: 'center',
  },
  tileValue: { fontSize: 19, fontWeight: '900' },
  tileLabel: { color: '#8B6914', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  trendBanner: {
    borderWidth: 1, borderRadius: 8, backgroundColor: '#0D0700',
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 18,
  },
  trendText: { fontSize: 12, fontWeight: '700' },
  sectionLabel: {
    color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginBottom: 10, marginTop: 6,
  },
  chartScroll: { marginBottom: 18 },
  chart: { flexDirection: 'row', gap: 10, paddingVertical: 4, position: 'relative' },
  targetLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: '#5A4210', zIndex: 1,
  },
  col: { alignItems: 'center', width: 44 },
  colValue: { color: '#C8A040', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  barTrack: { height: 130, width: 24, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, minHeight: 3 },
  colDate: { color: '#666', fontSize: 9, marginTop: 6 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#1F1305',
  },
  rowLabel: { color: '#FFF', fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '800' },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 10, marginBottom: 8,
  },
  sessionPct: {
    width: 56, height: 42, borderRadius: 6, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  sessionPctText: { fontSize: 14, fontWeight: '900' },
  sessionTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  sessionMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  chevron: { color: '#8B6914', fontSize: 20, fontWeight: '300' },
});
