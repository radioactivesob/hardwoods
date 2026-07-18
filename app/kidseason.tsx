import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useKidStats } from '../hooks/useKidStats';
import {
  STAT_DEFS, StatKey, GameEntry, pointsFromTotals, shootingLine, kidColor,
  profileSeason, gameSeason, gameResult,
} from '../hooks/kidStats';
import ScorePrompt from '../components/ScorePrompt';
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
  const { profiles, gamesForKid, deleteGame, setGameScore } = useKidStats();
  const profile = profiles.find(p => p.id === kidId) ?? null;
  const [metricKey, setMetricKey] = useState<MetricKey>('pts');
  const [seasonPick, setSeasonPick] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [scoreTarget, setScoreTarget] = useState<GameEntry | null>(null);

  if (!profile) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const allGames = gamesForKid(profile.id); // date ascending
  const currentSeason = profileSeason(profile);
  const seasons = Array.from(
    new Set([...allGames.map(gameSeason), currentSeason]),
  ).sort((a, b) => a - b);
  const season = seasonPick ?? currentSeason;
  const games = allGames.filter(g => gameSeason(g) === season);
  const metrics = buildMetrics(games);
  const metric = metrics.find(m => m.key === metricKey) ?? metrics[0];
  const values = games.map(g => metric.value(g));
  const maxValue = Math.max(...values, 1);

  const totalPoints = games.reduce((s, g) => s + pointsFromTotals(g.totals), 0);
  const agg = games.reduce(
    (acc, g) => {
      const line = shootingLine(g.totals);
      acc.fgMade += line.fgMade; acc.fgAttempted += line.fgAttempted;
      acc.rebounds += g.totals.rebound ?? 0;
      acc.steals += g.totals.steal ?? 0;
      return acc;
    },
    { fgMade: 0, fgAttempted: 0, rebounds: 0, steals: 0 },
  );
  const seasonFgPct = agg.fgAttempted > 0 ? Math.round((agg.fgMade / agg.fgAttempted) * 100) : null;

  const handleGameMenu = (game: GameEntry) => {
    const pts = pointsFromTotals(game.totals);
    Alert.alert(
      `${formatDate(game.date)}${game.opponent ? ` vs. ${game.opponent}` : ''}`,
      `${pts} pts${gameResult(game) ? ` · ${gameResult(game)}` : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: game.teamScore ? 'Edit Final Score' : 'Add Final Score',
          onPress: () => setScoreTarget(game),
        },
        {
          text: 'Delete Game',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Delete Game?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteGame(game.id) },
            ]);
          },
        },
      ],
    );
  };

  const exportReport = async () => {
    try {
      setExporting(true);
      const pct = (m: number, a: number) => (a > 0 ? `${m}/${a} (${Math.round((m / a) * 100)}%)` : '—');
      const lines = games.map(g => shootingLine(g.totals));
      const three = lines.reduce((acc, l) => ({ m: acc.m + l.threeMade, a: acc.a + l.threeAttempted }), { m: 0, a: 0 });
      const ft = lines.reduce((acc, l) => ({ m: acc.m + l.ftMade, a: acc.a + l.ftAttempted }), { m: 0, a: 0 });
      const sum = (key: StatKey) => games.reduce((s, g) => s + (g.totals[key] ?? 0), 0);
      const counting: [string, number][] = [
        ['Rebounds', sum('rebound')], ['Steals', sum('steal')], ['Assists', sum('assist')],
        ['Blocks', sum('block')], ['Turnovers', sum('turnover')], ['Fouls', sum('foul')],
      ];
      const best = games.reduce((b, g) => (pointsFromTotals(g.totals) > pointsFromTotals(b.totals) ? g : b), games[0]);
      const bestPts = pointsFromTotals(best.totals);

      const gameRows = games.map(g => {
        const l = shootingLine(g.totals);
        return `<tr><td>${formatDate(g.date)}</td><td>${g.opponent ?? '—'}</td><td>${gameResult(g) ?? '—'}</td><td><strong>${pointsFromTotals(g.totals)}</strong></td><td>${pct(l.fgMade, l.fgAttempted)}</td><td>${pct(l.ftMade, l.ftAttempted)}</td><td>${g.totals.rebound ?? 0}</td><td>${g.totals.steal ?? 0}</td><td>${g.totals.assist ?? 0}</td><td>${g.totals.foul ?? 0}</td></tr>`;
      }).join('');

      const summaryRows = [
        ['Games', `${games.length}`],
        ...(record ? [['Team record (tracked games)', record] as [string, string]] : []),
        ['Total points', `${totalPoints}`],
        ['Points per game', (totalPoints / games.length).toFixed(1)],
        ['Field goals', pct(agg.fgMade, agg.fgAttempted)],
        ['3-pointers', pct(three.m, three.a)],
        ['Free throws', pct(ft.m, ft.a)],
        ...counting.filter(([, v]) => v > 0).map(([label, v]) => [label, `${v}`] as [string, string]),
      ].map(([label, v]) => `<tr><td>${label}</td><td><strong>${v}</strong></td></tr>`).join('');

      const html = `<html><head><meta charset="utf-8"><style>
        body{font-family:-apple-system,Helvetica,sans-serif;color:#1A0F00;padding:32px}
        .brand{text-align:center;color:#8B6914;font-weight:800;letter-spacing:6px;font-size:13px}
        h1{text-align:center;color:${accent};margin:8px 0 2px;font-size:28px}
        .sub{text-align:center;color:#666;font-size:12px;margin-bottom:28px}
        h2{color:#8B6914;font-size:13px;letter-spacing:2px;border-bottom:2px solid #8B6914;padding-bottom:4px;margin-top:28px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
        th{color:#8B6914;font-size:10px;letter-spacing:1px}
        .hl{background:#FBF6EA;border-left:4px solid ${accent};padding:10px 14px;margin-top:8px;font-size:13px}
        .foot{text-align:center;color:#bbb;font-size:10px;margin-top:36px;font-style:italic}
      </style></head><body>
        <div class="brand">HARDWOODS</div>
        <h1>${profile.number ? `#${profile.number} ` : ''}${profile.name}</h1>
        <div class="sub">${profile.teamName ? `${profile.teamName} · ` : ''}Season ${season} Report · ${formatDate(games[0].date)} – ${formatDate(games[games.length - 1].date)}</div>
        <h2>SEASON SUMMARY</h2><table>${summaryRows}</table>
        <h2>HIGHLIGHT</h2>
        <div class="hl">Best game: <strong>${bestPts} points</strong> on ${formatDate(best.date)}${best.opponent ? ` vs. ${best.opponent}` : ''}</div>
        <h2>GAME BY GAME</h2>
        <table><tr><th>DATE</th><th>OPPONENT</th><th>RESULT</th><th>PTS</th><th>FG</th><th>FT</th><th>REB</th><th>STL</th><th>AST</th><th>PF</th></tr>${gameRows}</table>
        <div class="foot">tracked from the stands with Hardwoods</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${profile.name} — Season ${season} Report`, UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Export Failed', 'Could not create the report. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const scored = games.filter(g => g.teamScore);
  const record = scored.length
    ? `${scored.filter(g => g.teamScore!.us > g.teamScore!.them).length}-${scored.filter(g => g.teamScore!.us < g.teamScore!.them).length}`
    : null;

  const summaryTiles = [
    { label: 'GAMES', value: `${games.length}` },
    ...(record ? [{ label: 'TEAM RECORD', value: record }] : []),
    { label: 'PTS/GAME', value: games.length ? (totalPoints / games.length).toFixed(1) : '—' },
    ...(seasonFgPct !== null ? [{ label: 'SEASON FG%', value: `${seasonFgPct}%` }] : []),
    ...(agg.rebounds > 0 ? [{ label: 'REBOUNDS', value: `${agg.rebounds}` }] : []),
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
        {games.length > 0 ? (
          <TouchableOpacity onPress={() => router.push({ pathname: '/kidshare', params: { kidId: profile.id, season: String(season) } })}>
            <Text style={styles.shareText}>📤 SHARE</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      {allGames.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptyHint}>
            Track a game from {profile.name}'s profile and the season story starts here.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {seasons.length > 1 && (
            <View style={styles.seasonRow}>
              {seasons.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.seasonChip, season === s && { borderColor: accent, backgroundColor: '#3D2800' }]}
                  onPress={() => setSeasonPick(s)}
                >
                  <Text style={[styles.seasonChipText, season === s && { color: accent }]}>
                    SEASON {s}{s === currentSeason ? ' ·' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {games.length === 0 && (
            <View style={styles.emptySeason}>
              <Text style={styles.emptyHint}>
                Season {season} is a fresh start — no games tracked yet.
              </Text>
            </View>
          )}

          {games.length > 0 && (<>
          <View style={styles.summaryRow}>
            {summaryTiles.map(t => (
              <View key={t.label} style={styles.summaryTile}>
                <Text style={[styles.summaryValue, { color: accent }]}>{t.value}</Text>
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
                    <View style={[styles.chartBar, { backgroundColor: accent, height: `${Math.max((values[i] / maxValue) * 100, 3)}%` }]} />
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
                onPress={() => router.push({ pathname: '/kidshare', params: { kidId: profile.id, gameId: g.id } })}
                onLongPress={() => handleGameMenu(g)}
                activeOpacity={0.8}
              >
                <View style={styles.gamePts}>
                  <Text style={[styles.gamePtsText, { color: accent }]}>{pts}</Text>
                  <Text style={styles.gamePtsLabel}>PTS</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.gameTitle}>
                    {formatDate(g.date)}{g.opponent ? ` · vs. ${g.opponent}` : ''}
                    {gameResult(g) ? <Text style={{ color: (g.teamScore!.us >= g.teamScore!.them) ? '#4CAF50' : '#C25E5E' }}>  {gameResult(g)}</Text> : null}
                  </Text>
                  <Text style={styles.gameMeta}>{parts.join(' · ') || `${g.events.length} stats recorded`}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.deleteHint}>Tap a game to share it · long-press for score & delete.</Text>

          <TouchableOpacity
            style={[styles.reportBtn, exporting && { opacity: 0.5 }]}
            onPress={exporting ? undefined : exportReport}
          >
            <Text style={styles.reportBtnText}>
              {exporting ? 'PREPARING…' : `📄 SEASON ${season} REPORT (PDF)`}
            </Text>
          </TouchableOpacity>
          </>)}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
      <ScorePrompt
        visible={!!scoreTarget}
        accent={accent}
        initial={scoreTarget?.teamScore}
        onCancel={() => setScoreTarget(null)}
        onSubmit={score => {
          if (score && scoreTarget) setGameScore(scoreTarget.id, score);
          setScoreTarget(null);
        }}
      />
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptySeason: { alignItems: 'center', paddingVertical: 24 },
  seasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  seasonChip: {
    borderWidth: 1, borderColor: '#2A1A00', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#0D0700',
  },
  seasonChipText: { color: '#555', fontSize: 11, fontWeight: '700' },
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
  reportBtn: {
    borderWidth: 1, borderColor: '#8B6914', borderRadius: 8,
    paddingVertical: 12, alignItems: 'center', marginTop: 16,
  },
  reportBtnText: { color: '#C8A040', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
