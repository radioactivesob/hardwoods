import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKidStats } from '../hooks/useKidStats';
import {
  STAT_DEFS, StatKey, GameEntry, pointsFromTotals, shootingLine,
} from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

type MetricKey = 'pts' | 'fgPct' | StatKey;

interface Metric {
  key: MetricKey;
  label: string;
  value: (g: GameEntry) => number;
  format: (v: number) => string;
}

function buildMetrics(games: GameEntry[]): Metric[] {
  const metrics: Metric[] = [
    { key: 'pts', label: 'PTS', value: g => pointsFromTotals(g.totals), format: v => `${v}` },
  ];
  const anyAttempts = games.some(g => shootingLine(g.totals).fgAttempted > 0);
  if (anyAttempts) {
    metrics.push({
      key: 'fgPct',
      label: 'FG%',
      value: g => {
        const s = shootingLine(g.totals);
        return s.fgAttempted > 0 ? Math.round((s.fgMade / s.fgAttempted) * 100) : 0;
      },
      format: v => `${v}%`,
    });
  }
  const COUNT_METRICS: StatKey[] = ['rebound', 'steal', 'assist', 'block', 'turnover', 'foul'];
  COUNT_METRICS.forEach(key => {
    if (games.some(g => (g.totals[key] ?? 0) > 0)) {
      metrics.push({
        key,
        label: STAT_DEFS[key].shortLabel,
        value: g => g.totals[key] ?? 0,
        format: v => `${v}`,
      });
    }
  });
  return metrics;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KidSeason() {
  useAllOrientations();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId: string }>();
  const { profiles, gamesForKid, deleteGame } = useKidStats();
  const profile = profiles.find(p => p.id === kidId) ?? null;
  const [metricKey, setMetricKey] = useState<MetricKey>('pts');

  if (!profile) return <SafeAreaView style={styles.container} />;

  const games = gamesForKid(profile.id); // date ascending
  const metrics = buildMetrics(games);
  const metric = metrics.find(m => m.key === metricKey) ?? metrics[0];
  const values = games.map(g => metric.value(g));
  const maxValue = Math.max(...values, 1);

  const totalPoints = games.reduce((s, g) => s + pointsFromTotals(g.totals), 0);
  const season = games.reduce(
    (acc, g) => {
      const line = shootingLine(g.totals);
      acc.fgMade += line.fgMade; acc.fgAttempted += line.fgAttempted;
      acc.rebounds += g.totals.rebound ?? 0;
      acc.steals += g.totals.steal ?? 0;
      return acc;
    },
    { fgMade: 0, fgAttempted: 0, rebounds: 0, steals: 0 },
  );
  const seasonFgPct = season.fgAttempted > 0 ? Math.round((season.fgMade / season.fgAttempted) * 100) : null;

  const handleDeleteGame = (game: GameEntry) => {
    const pts = pointsFromTotals(game.totals);
    Alert.alert(
      'Delete Game?',
      `${formatDate(game.date)}${game.opponent ? ` vs. ${game.opponent}` : ''} · ${pts} pts. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteGame(game.id) },
      ],
    );
  };

  const summaryTiles = [
    { label: 'GAMES', value: `${games.length}` },
    { label: 'PTS/GAME', value: games.length ? (totalPoints / games.length).toFixed(1) : '—' },
    ...(seasonFgPct !== null ? [{ label: 'SEASON FG%', value: `${seasonFgPct}%` }] : []),
    ...(season.rebounds > 0 ? [{ label: 'REBOUNDS', value: `${season.rebounds}` }] : []),
  ].slice(0, 4);

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

      {games.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptyHint}>
            Track a game from {profile.name}'s profile and the season story starts here.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          <View style={styles.summaryRow}>
            {summaryTiles.map(t => (
              <View key={t.label} style={styles.summaryTile}>
                <Text style={styles.summaryValue}>{t.value}</Text>
                <Text style={styles.summaryLabel}>{t.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>GAME BY GAME</Text>
          <View style={styles.metricRow}>
            {metrics.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.metricChip, metric.key === m.key && styles.metricChipOn]}
                onPress={() => setMetricKey(m.key)}
              >
                <Text style={[styles.metricChipText, metric.key === m.key && styles.metricChipTextOn]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
            <View style={styles.chart}>
              {games.map((g, i) => (
                <View key={g.id} style={styles.chartCol}>
                  <Text style={styles.chartValue}>{metric.format(values[i])}</Text>
                  <View style={styles.chartBarTrack}>
                    <View style={[styles.chartBar, { height: `${Math.max((values[i] / maxValue) * 100, 3)}%` }]} />
                  </View>
                  <Text style={styles.chartDate}>{formatDate(g.date)}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.sectionLabel}>GAMES ({games.length})</Text>
          {[...games].reverse().map(g => {
            const pts = pointsFromTotals(g.totals);
            const line = shootingLine(g.totals);
            const parts = [
              line.fgAttempted > 0 ? `${line.fgMade}/${line.fgAttempted} FG` : null,
              (g.totals.rebound ?? 0) > 0 ? `${g.totals.rebound} REB` : null,
              (g.totals.steal ?? 0) > 0 ? `${g.totals.steal} STL` : null,
              (g.totals.assist ?? 0) > 0 ? `${g.totals.assist} AST` : null,
              (g.totals.foul ?? 0) > 0 ? `${g.totals.foul} PF` : null,
            ].filter(Boolean);
            return (
              <TouchableOpacity
                key={g.id}
                style={styles.gameRow}
                onLongPress={() => handleDeleteGame(g)}
                activeOpacity={0.8}
              >
                <View style={styles.gamePts}>
                  <Text style={styles.gamePtsText}>{pts}</Text>
                  <Text style={styles.gamePtsLabel}>PTS</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameTitle}>
                    {formatDate(g.date)}{g.opponent ? ` · vs. ${g.opponent}` : ''}
                  </Text>
                  <Text style={styles.gameMeta}>{parts.join(' · ') || `${g.events.length} stats recorded`}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.deleteHint}>Long-press a game to delete it.</Text>

          <View style={{ height: 20 }} />
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scrollContent: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  summaryTile: {
    flex: 1, backgroundColor: '#0D0700', borderRadius: 10,
    borderWidth: 1, borderColor: '#2A1A00', paddingVertical: 14, alignItems: 'center',
  },
  summaryValue: { color: '#FF8A1F', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: '#8B6914', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  sectionLabel: { color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  metricChip: {
    borderWidth: 1, borderColor: '#2A1A00', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#0D0700',
  },
  metricChipOn: { borderColor: '#C8A040', backgroundColor: '#3D2800' },
  metricChipText: { color: '#555', fontSize: 11, fontWeight: '700' },
  metricChipTextOn: { color: '#C8A040' },
  chartScroll: { marginBottom: 20 },
  chart: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  chartCol: { alignItems: 'center', width: 40 },
  chartValue: { color: '#C8A040', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  chartBarTrack: { height: 110, width: 22, justifyContent: 'flex-end' },
  chartBar: { width: '100%', backgroundColor: '#FF8A1F', borderRadius: 4, minHeight: 3 },
  chartDate: { color: '#666', fontSize: 9, marginTop: 6 },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 12, marginBottom: 8,
  },
  gamePts: {
    width: 52, height: 52, borderRadius: 8, backgroundColor: '#1A0F00',
    borderWidth: 1, borderColor: '#3D2800', justifyContent: 'center', alignItems: 'center',
  },
  gamePtsText: { color: '#FF8A1F', fontSize: 18, fontWeight: '900' },
  gamePtsLabel: { color: '#8B6914', fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  gameTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  gameMeta: { color: '#666', fontSize: 11 },
  deleteHint: { color: '#444', fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
});
