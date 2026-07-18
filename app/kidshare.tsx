import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useKidStats } from '../hooks/useKidStats';
import {
  STAT_DEFS, GameEntry, pointsFromTotals, shootingLine, kidColor,
  profileSeason, gameSeason, gameResult,
} from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shotLine(made: number, attempted: number) {
  if (attempted === 0) return null;
  return `${made}/${attempted} (${Math.round((made / attempted) * 100)}%)`;
}

export default function KidShare() {
  useAllOrientations();
  const router = useRouter();
  const { kidId, gameId, season: seasonParam } = useLocalSearchParams<{ kidId: string; gameId?: string; season?: string }>();
  const { profiles, gamesForKid } = useKidStats();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const profile = profiles.find(p => p.id === kidId) ?? null;
  if (!profile) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const season = seasonParam ? parseInt(seasonParam, 10) : profileSeason(profile);
  const games = gamesForKid(profile.id).filter(g => gameSeason(g) === season);
  const game: GameEntry | null = gameId
    ? gamesForKid(profile.id).find(g => g.id === gameId) ?? null
    : null;
  const seasonMode = !game;

  // Rows for the card: label + value pairs, only stats with data.
  let rows: { label: string; value: string }[] = [];
  let headline = '';
  let subtitle = '';

  if (game) {
    const line = shootingLine(game.totals);
    headline = `${pointsFromTotals(game.totals)}`;
    subtitle = `${formatDate(game.date)}${game.opponent ? `  ·  vs. ${game.opponent}` : ''}${gameResult(game) ? `  ·  ${gameResult(game)}` : ''}`;
    rows = [
      { label: 'FIELD GOALS', value: shotLine(line.fgMade, line.fgAttempted) ?? '' },
      { label: '3-POINTERS', value: shotLine(line.threeMade, line.threeAttempted) ?? '' },
      { label: 'FREE THROWS', value: shotLine(line.ftMade, line.ftAttempted) ?? '' },
      { label: 'REBOUNDS', value: game.totals.rebound ? `${game.totals.rebound}` : '' },
      { label: 'STEALS', value: game.totals.steal ? `${game.totals.steal}` : '' },
      { label: 'ASSISTS', value: game.totals.assist ? `${game.totals.assist}` : '' },
      { label: 'BLOCKS', value: game.totals.block ? `${game.totals.block}` : '' },
      { label: 'FOULS', value: game.totals.foul ? `${game.totals.foul}` : '' },
    ].filter(r => r.value !== '');
  } else {
    const totalPoints = games.reduce((s, g) => s + pointsFromTotals(g.totals), 0);
    const agg = games.reduce(
      (acc, g) => {
        const l = shootingLine(g.totals);
        acc.fgMade += l.fgMade; acc.fgAttempted += l.fgAttempted;
        acc.rebounds += g.totals.rebound ?? 0;
        acc.steals += g.totals.steal ?? 0;
        acc.assists += g.totals.assist ?? 0;
        return acc;
      },
      { fgMade: 0, fgAttempted: 0, rebounds: 0, steals: 0, assists: 0 },
    );
    headline = games.length ? (totalPoints / games.length).toFixed(1) : '0';
    subtitle = `Season ${season}  ·  ${games.length} game${games.length === 1 ? '' : 's'}`;
    rows = [
      { label: 'TOTAL POINTS', value: `${totalPoints}` },
      { label: 'FIELD GOALS', value: shotLine(agg.fgMade, agg.fgAttempted) ?? '' },
      { label: 'REBOUNDS', value: agg.rebounds ? `${agg.rebounds}` : '' },
      { label: 'STEALS', value: agg.steals ? `${agg.steals}` : '' },
      { label: 'ASSISTS', value: agg.assists ? `${agg.assists}` : '' },
    ].filter(r => r.value !== '');
  }

  const share = async () => {
    try {
      setSharing(true);
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: `${profile.name}'s stats` });
      } else {
        Alert.alert('Sharing Unavailable', 'This device cannot open the share sheet.');
      }
    } catch (e) {
      Alert.alert('Share Failed', 'Could not create the image. Try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← DONE</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SHARE CARD</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View ref={cardRef} collapsable={false} style={[styles.card, { borderColor: accent }]}>
          <Text style={styles.cardBrand}>HARDWOODS</Text>
          <Text style={[styles.cardName, { color: accent }]}>
            {profile.number ? `#${profile.number}  ` : ''}{profile.name.toUpperCase()}
          </Text>
          {profile.teamName ? <Text style={styles.cardTeam}>{profile.teamName}</Text> : null}

          <View style={styles.headlineRow}>
            <Text style={[styles.headlineValue, { color: accent }]}>{headline}</Text>
            <Text style={styles.headlineLabel}>{seasonMode ? 'PTS / GAME' : 'POINTS'}</Text>
          </View>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>

          <View style={styles.divider} />

          {rows.map(r => (
            <View key={r.label} style={styles.statRow}>
              <Text style={styles.statLabel}>{r.label}</Text>
              <Text style={styles.statValue}>{r.value}</Text>
            </View>
          ))}

          <Text style={styles.cardFooter}>tracked from the stands with Hardwoods</Text>
        </View>

        <TouchableOpacity
          style={[styles.shareBtn, { backgroundColor: sharing ? '#3D2800' : '#8B6914' }]}
          onPress={sharing ? undefined : share}
        >
          <Text style={styles.shareBtnText}>{sharing ? 'PREPARING…' : '📤 SHARE AS IMAGE'}</Text>
        </TouchableOpacity>
        <Text style={styles.shareHint}>Opens the share sheet — text it, post it, save it.</Text>

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
    width: 340, backgroundColor: '#120900', borderRadius: 16, borderWidth: 2,
    paddingVertical: 24, paddingHorizontal: 24,
  },
  cardBrand: {
    color: '#8B6914', fontSize: 12, fontWeight: '900', letterSpacing: 4,
    textAlign: 'center', marginBottom: 14,
  },
  cardName: { fontSize: 24, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  cardTeam: { color: '#888', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  headlineRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center',
    gap: 8, marginTop: 18,
  },
  headlineValue: { fontSize: 56, fontWeight: '900' },
  headlineLabel: { color: '#8B6914', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  cardSubtitle: { color: '#999', fontSize: 12, textAlign: 'center', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#3D2800', marginVertical: 18 },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7,
  },
  statLabel: { color: '#8B6914', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  statValue: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  cardFooter: {
    color: '#5A4210', fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 18,
  },
  shareBtn: {
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 40, marginTop: 20,
    alignItems: 'center',
  },
  shareBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  shareHint: { color: '#555', fontSize: 11, marginTop: 8 },
});
