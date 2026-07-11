import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTeamGames, ArchivedPlayer } from '../hooks/useTeamGames';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface PlayerAgg {
  key: string;
  name: string;
  number: string;
  gp: number;
  points: number;
  fgMade: number;
  fgAttempted: number;
  fouls: number;
}

export default function TeamSeasons() {
  useAllOrientations();
  const router = useRouter();
  const { loading, teams, gamesForTeam, deleteGame } = useTeamGames();
  const [selected, setSelected] = useState<string | null>(null);
  const [opponentFilter, setOpponentFilter] = useState<string | null>(null);

  const teamList = teams();
  const team = selected ? teamList.find(t => t.name.trim().toLowerCase() === selected.trim().toLowerCase()) ?? null : null;

  const back = () => {
    if (opponentFilter) setOpponentFilter(null);
    else if (selected) setSelected(null);
    else router.back();
  };

  let body: React.ReactNode;

  if (!team) {
    body = teamList.length === 0 ? (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No archived games yet</Text>
        <Text style={styles.emptyHint}>
          Run a game in the Full Scorebook and tap END GAME to save it here.
          Seasons build themselves from your saved games.
        </Text>
      </View>
    ) : (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionLabel}>TEAMS</Text>
        {teamList.map(t => (
          <TouchableOpacity key={t.name} style={styles.teamRow} onPress={() => setSelected(t.name)}>
            <View style={[styles.colorDot, { backgroundColor: t.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName}>{t.name}</Text>
              <Text style={styles.teamMeta}>{t.games} game{t.games === 1 ? '' : 's'}</Text>
            </View>
            <Text style={styles.record}>
              {t.wins}–{t.losses}{t.ties > 0 ? `–${t.ties}` : ''}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  } else {
    const all = gamesForTeam(team.name);
    const rows = opponentFilter
      ? all.filter(r => r.them.name.trim().toLowerCase() === opponentFilter.trim().toLowerCase())
      : all;
    const wins = rows.filter(r => r.usScore > r.themScore).length;
    const losses = rows.filter(r => r.usScore < r.themScore).length;
    const ppgFor = rows.length ? (rows.reduce((s, r) => s + r.usScore, 0) / rows.length).toFixed(1) : '—';
    const ppgAgainst = rows.length ? (rows.reduce((s, r) => s + r.themScore, 0) / rows.length).toFixed(1) : '—';
    const maxScore = Math.max(...rows.map(r => Math.max(r.usScore, r.themScore)), 1);

    const opponents = Array.from(new Set(all.map(r => r.them.name.trim()).filter(Boolean)));

    // Season averages per player, aggregated by name+number.
    const aggMap = new Map<string, PlayerAgg>();
    rows.forEach(r => {
      r.us.players.forEach((p: ArchivedPlayer) => {
        const key = `${p.number}|${p.name.toLowerCase()}`;
        const a = aggMap.get(key) ?? { key, name: p.name, number: p.number, gp: 0, points: 0, fgMade: 0, fgAttempted: 0, fouls: 0 };
        a.gp += 1;
        a.points += p.stats.points;
        a.fgMade += p.stats.fgMade;
        a.fgAttempted += p.stats.fgAttempted;
        a.fouls += p.stats.fouls;
        aggMap.set(key, a);
      });
    });
    const players = Array.from(aggMap.values()).sort((a, b) => b.points - a.points);

    body = (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {opponents.length > 1 && (
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, !opponentFilter && styles.filterChipOn]}
              onPress={() => setOpponentFilter(null)}
            >
              <Text style={[styles.filterChipText, !opponentFilter && styles.filterChipTextOn]}>ALL</Text>
            </TouchableOpacity>
            {opponents.map(o => (
              <TouchableOpacity
                key={o}
                style={[styles.filterChip, opponentFilter === o && styles.filterChipOn]}
                onPress={() => setOpponentFilter(opponentFilter === o ? null : o)}
              >
                <Text style={[styles.filterChipText, opponentFilter === o && styles.filterChipTextOn]}>vs. {o}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={[styles.summaryValue, { color: team.color }]}>{wins}–{losses}</Text>
            <Text style={styles.summaryLabel}>RECORD</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={[styles.summaryValue, { color: team.color }]}>{ppgFor}</Text>
            <Text style={styles.summaryLabel}>PTS FOR</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={[styles.summaryValue, { color: team.color }]}>{ppgAgainst}</Text>
            <Text style={styles.summaryLabel}>PTS AGAINST</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>GAME BY GAME</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
          <View style={styles.chart}>
            {rows.map(r => (
              <View key={r.game.id} style={styles.chartCol}>
                <Text style={styles.chartValue}>{r.usScore}</Text>
                <View style={styles.chartBarTrack}>
                  <View style={[styles.chartBar, { backgroundColor: team.color, height: `${Math.max((r.usScore / maxScore) * 100, 3)}%` }]} />
                  <View style={[styles.chartBar, styles.chartBarThem, { height: `${Math.max((r.themScore / maxScore) * 100, 3)}%` }]} />
                </View>
                <Text style={styles.chartDate}>{formatDate(r.game.date)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.chartLegend}>colored = {team.name} · gray = opponent</Text>

        <Text style={styles.sectionLabel}>GAMES ({rows.length})</Text>
        {[...rows].reverse().map(r => {
          const won = r.usScore > r.themScore;
          return (
            <TouchableOpacity
              key={r.game.id}
              style={styles.gameRow}
              onLongPress={() => {
                Alert.alert('Delete Game?', `${formatDate(r.game.date)} vs. ${r.them.name || 'opponent'}. This cannot be undone.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteGame(r.game.id) },
                ]);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.resultBadge, { backgroundColor: won ? '#1F4A22' : '#4A1F1F' }]}>
                <Text style={[styles.resultBadgeText, { color: won ? '#6FCF77' : '#CF6F6F' }]}>{won ? 'W' : r.usScore === r.themScore ? 'T' : 'L'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gameTitle}>{formatDate(r.game.date)} · vs. {r.them.name || 'Opponent'}</Text>
                <Text style={styles.gameMeta}>{r.usScore} — {r.themScore}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.deleteHint}>Long-press a game to delete it.</Text>

        {players.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PLAYER SEASON AVERAGES</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.cellName, styles.headerCell]}>PLAYER</Text>
              <Text style={[styles.cell, styles.headerCell]}>GP</Text>
              <Text style={[styles.cell, styles.headerCell]}>PPG</Text>
              <Text style={[styles.cell, styles.headerCell]}>FG%</Text>
              <Text style={[styles.cell, styles.headerCell]}>PF/G</Text>
            </View>
            {players.map(p => (
              <View key={p.key} style={styles.tableRow}>
                <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
                  {p.number ? `#${p.number} ` : ''}{p.name}
                </Text>
                <Text style={styles.cell}>{p.gp}</Text>
                <Text style={styles.cell}>{(p.points / p.gp).toFixed(1)}</Text>
                <Text style={styles.cell}>{p.fgAttempted > 0 ? `${Math.round((p.fgMade / p.fgAttempted) * 100)}%` : '—'}</Text>
                <Text style={styles.cell}>{(p.fouls / p.gp).toFixed(1)}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={back}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {team ? team.name.toUpperCase() : 'TEAM SEASONS'}
        </Text>
        <View style={{ width: 50 }} />
      </View>
      {!loading && body}
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
  scrollContent: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  sectionLabel: { color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginTop: 8 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginBottom: 8,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  teamName: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  teamMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  record: { color: '#C8A040', fontSize: 16, fontWeight: '900' },
  chevron: { color: '#8B6914', fontSize: 20, fontWeight: '300' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  filterChip: {
    borderWidth: 1, borderColor: '#2A1A00', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#0D0700',
  },
  filterChipOn: { borderColor: '#C8A040', backgroundColor: '#3D2800' },
  filterChipText: { color: '#555', fontSize: 11, fontWeight: '700' },
  filterChipTextOn: { color: '#C8A040' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryTile: {
    flex: 1, backgroundColor: '#0D0700', borderRadius: 10,
    borderWidth: 1, borderColor: '#2A1A00', paddingVertical: 14, alignItems: 'center',
  },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: '#8B6914', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  chartScroll: { marginBottom: 4 },
  chart: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  chartCol: { alignItems: 'center', width: 44 },
  chartValue: { color: '#C8A040', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  chartBarTrack: { height: 100, flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  chartBar: { width: 12, borderRadius: 3, minHeight: 3 },
  chartBarThem: { backgroundColor: '#444' },
  chartDate: { color: '#666', fontSize: 9, marginTop: 6 },
  chartLegend: { color: '#555', fontSize: 10, fontStyle: 'italic', marginBottom: 12 },
  gameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 12, marginBottom: 8,
  },
  resultBadge: {
    width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  resultBadgeText: { fontSize: 15, fontWeight: '900' },
  gameTitle: { color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  gameMeta: { color: '#8B6914', fontSize: 12, fontWeight: '700' },
  deleteHint: { color: '#444', fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 4, marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: '#3D2800',
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: '#241505',
  },
  cell: { flex: 1, color: '#DDD', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cellName: { flex: 2.2, textAlign: 'left', color: '#FFF' },
  headerCell: { color: '#8B6914', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
