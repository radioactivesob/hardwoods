import React, { useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { buildTeamTransfer, suggestTeamFileName } from '../hooks/teamTransfer';
import { useTeamGames, ArchivedPlayer } from '../hooks/useTeamGames';
import { StatKey } from '../hooks/kidStats';
import { byJersey } from '../hooks/teamStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

// Rosters carry full names, but the card has seven stat columns to fit —
// "Tessa B." reads better than "Tessa B…" cut off by the ellipsis.
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name.trim();
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Box-score columns, in the order a coach reads them. Only columns with
 * something in them are shown, and the card holds six beyond points before
 * it gets cramped.
 */
interface Column {
  label: string;
  value: (p: ArchivedPlayer) => string;
  present: (p: ArchivedPlayer) => boolean;
}
const shot = (m: number, a: number) => (a > 0 ? `${m}-${a}` : '–');
const count = (key: StatKey) => ({
  value: (p: ArchivedPlayer) => `${p.totals?.[key] ?? 0}`,
  present: (p: ArchivedPlayer) => (p.totals?.[key] ?? 0) > 0,
});
const COLUMNS: Column[] = [
  { label: 'FG', value: p => shot(p.stats.fgMade, p.stats.fgAttempted), present: p => p.stats.fgAttempted > 0 },
  { label: 'REB', ...count('rebound') },
  { label: 'AST', ...count('assist') },
  { label: 'STL', ...count('steal') },
  { label: 'FT', value: p => shot(p.stats.ftMade, p.stats.ftAttempted), present: p => p.stats.ftAttempted > 0 },
  { label: '3PT', value: p => shot(p.stats.threeMade, p.stats.threeAttempted), present: p => p.stats.threeAttempted > 0 },
  { label: 'PF', value: p => `${p.stats.fouls}`, present: p => p.stats.fouls > 0 },
  { label: 'BLK', ...count('block') },
  { label: 'TO', ...count('turnover') },
];
const MAX_COLUMNS = 6;

export default function TeamStatsShare() {
  useAllOrientations();
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { games, loading } = useTeamGames();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [sendingFile, setSendingFile] = useState(false);

  const game = games.find(g => g.id === gameId) ?? null;
  if (loading || !game) return <SafeAreaView style={styles.container} />;

  const us = game.teamA;
  const them = game.teamB;
  const won = game.finalA > game.finalB;
  const result = won ? 'W' : game.finalA < game.finalB ? 'L' : 'T';
  const color = us.color;
  // Jersey order, the way the coach reads it against her own roster sheet.
  const players = us.players.map((p, i) => ({ ...p, i })).sort(byJersey);
  const columns = COLUMNS.filter(c => players.some(c.present)).slice(0, MAX_COLUMNS);

  const share = async () => {
    try {
      setSharing(true);
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: `${us.name} box score` });
      } else {
        Alert.alert('Sharing Unavailable', 'This device cannot open the share sheet.');
      }
    } catch {
      Alert.alert('Share Failed', 'Could not create the image. Try again.');
    } finally {
      setSharing(false);
    }
  };

  // The image is for people; this is for another copy of Hardwoods — the
  // parent who keeps the season, or a coach with the app.
  const shareData = async () => {
    try {
      setSendingFile(true);
      const file = new File(Paths.cache, suggestTeamFileName(game));
      file.create({ overwrite: true });
      file.write(JSON.stringify(buildTeamTransfer(game)));
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing Unavailable', 'This device cannot open the share sheet.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: `${us.name} vs. ${them.name}`,
        UTI: 'com.hardwoods.gamefile',
      });
    } catch {
      Alert.alert('Share Failed', 'Could not create the file. Try again.');
    } finally {
      setSendingFile(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/teamstats'))}>
          <Text style={styles.backText}>← DONE</Text>
        </TouchableOpacity>
        <Text style={styles.title}>BOX SCORE</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View ref={cardRef} collapsable={false} style={[styles.card, { borderColor: color }]}>
          <Text style={styles.cardBrand}>HARDWOODS</Text>
          <Text style={[styles.cardTeam, { color }]} numberOfLines={1}>{us.name.toUpperCase()}</Text>

          <View style={styles.scoreRow}>
            <Text style={[styles.scoreUs, { color }]}>{game.finalA}</Text>
            <Text style={styles.scoreDash}>–</Text>
            <Text style={styles.scoreThem}>{game.finalB}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {result} vs. {them.name}  ·  {formatDate(game.date)}
          </Text>

          <View style={styles.divider} />

          <View style={styles.tableRow}>
            <Text style={[styles.cell, styles.cellName, styles.headerCell]}>PLAYER</Text>
            <Text style={[styles.cell, styles.headerCell, styles.cellPts]}>PTS</Text>
            {columns.map(c => (
              <Text key={c.label} style={[styles.cell, styles.headerCell]}>{c.label}</Text>
            ))}
          </View>
          {players.map((p, i) => (
            <View key={`${p.number}-${p.name}-${i}`} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
                {p.number ? <Text style={{ color }}>#{p.number} </Text> : null}{shortName(p.name)}
              </Text>
              <Text style={[styles.cell, styles.cellPts, styles.cellStrong]}>{p.stats.points}</Text>
              {columns.map(c => (
                <Text key={c.label} style={styles.cell}>{c.value(p)}</Text>
              ))}
            </View>
          ))}

          <Text style={styles.cardFooter}>tracked from the stands with Hardwoods</Text>
        </View>

        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: sharing ? '#3D2800' : '#8B6914' }]}
          onPress={sharing ? undefined : share}
        >
          <Text style={styles.shareBtnText}>{sharing ? 'PREPARING…' : 'SHARE AS IMAGE'}</Text>
        </TouchableOpacity>
        <Text style={styles.shareHint}>A picture of the box score — text it to the coach, post it, save it.</Text>

        <TouchableOpacity
          style={[styles.dataBtn, sendingFile && { opacity: 0.6 }]}
          onPress={sendingFile ? undefined : shareData}
        >
          <Text style={styles.dataBtnText}>{sendingFile ? 'PREPARING…' : 'SHARE STATS'}</Text>
        </TouchableOpacity>
        <Text style={styles.shareHint}>
          Sends the game as data. Another phone with Hardwoods adds it to Team
          Seasons — and to any player's My Kid profile it finds there.
        </Text>
        <Text style={[styles.shareHint, { marginTop: 14 }]}>This game is saved under Team Seasons.</Text>

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
  title: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  scrollContent: { padding: 20, alignItems: 'center' },
  card: {
    width: 360, backgroundColor: '#120900', borderRadius: 16, borderWidth: 2,
    paddingVertical: 22, paddingHorizontal: 18,
  },
  cardBrand: {
    color: '#8B6914', fontSize: 12, fontWeight: '900', letterSpacing: 4,
    textAlign: 'center', marginBottom: 12,
  },
  cardTeam: { fontSize: 22, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
  scoreRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    gap: 10, marginTop: 12,
  },
  scoreUs: { fontSize: 48, fontWeight: '900' },
  scoreDash: { color: '#555', fontSize: 30, fontWeight: '900' },
  scoreThem: { color: '#888', fontSize: 48, fontWeight: '900' },
  cardSubtitle: { color: '#999', fontSize: 12, textAlign: 'center', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#3D2800', marginVertical: 14 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4, borderRadius: 4 },
  tableRowAlt: { backgroundColor: '#1A0F00' },
  cell: { flex: 1, color: '#DDD', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cellName: { flex: 2.6, textAlign: 'left', color: '#FFF' },
  cellPts: { color: '#FFF' },
  cellStrong: { fontWeight: '900', fontSize: 13 },
  headerCell: { color: '#8B6914', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardFooter: {
    color: '#5A4210', fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 16,
  },
  shareBtn: {
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginTop: 20,
    alignItems: 'center',
  },
  shareBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  dataBtn: {
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginTop: 18,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#8B6914',
  },
  dataBtnText: { color: '#C8A040', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  shareHint: { color: '#555', fontSize: 11, marginTop: 8, textAlign: 'center', maxWidth: 320 },
});
