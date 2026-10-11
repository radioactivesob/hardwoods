import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamGames } from '../hooks/useTeamGames';
import { useKidStats } from '../hooks/useKidStats';
import { findProfileForPlayer, profileSeason, totalsFromEvents } from '../hooks/kidStats';
import { fingerprintGame, toGameEntry } from '../hooks/kidTransfer';
import { parseTeamSeason, planSeasonMerge, toArchivedGames } from '../hooks/teamSeasonTransfer';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Merge a whole team season someone sent. The coach's path: open the file,
 * get every game in Team Seasons — records, box scores, and the player
 * averages table, which is what a picture of a box score can't give him.
 *
 * Additive and idempotent, like every other import: games already here are
 * skipped by fingerprint, so a coach can be sent an updated season each week
 * and only the new games land.
 */
export default function TeamSeasonImport() {
  useAllOrientations();
  const router = useRouter();
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  const { games, archiveGame, loading: archiveLoading } = useTeamGames();
  const { profiles, gamesForKid, importGames, loading: kidsLoading } = useKidStats();
  const [status, setStatus] = useState('Reading season…');
  const ran = useRef(false);

  useEffect(() => {
    if (archiveLoading || kidsLoading || ran.current) return;
    ran.current = true;
    run();
  }, [archiveLoading, kidsLoading]);

  const done = () => router.replace('/teamseasons');

  const run = () => {
    let json: unknown;
    try {
      json = JSON.parse(payload ?? '');
    } catch {
      Alert.alert('Could Not Read File', "That file couldn't be opened.", [{ text: 'OK', onPress: done }]);
      return;
    }
    const parsed = parseTeamSeason(json);
    if (!parsed.ok) {
      Alert.alert('Could Not Import', parsed.error, [{ text: 'OK', onPress: done }]);
      return;
    }
    const file = parsed.file;
    setStatus(`${file.team.name} — ${file.games.length} games`);

    const plan = planSeasonMerge(file, games);
    if (plan.fresh.length === 0) {
      Alert.alert(
        'Nothing New',
        `You already have all ${file.games.length} games from ${file.team.name}.`,
        [{ text: 'OK', onPress: done }],
      );
      return;
    }

    // Any player in the incoming games who has a My Kid profile here. One
    // prompt for the whole season rather than one per game.
    const byProfile = new Map<string, { name: string; lines: { events: NonNullable<ReturnType<typeof linesFor>>[number]['events']; game: typeof plan.fresh[number] }[] }>();
    function linesFor(g: typeof plan.fresh[number]) {
      return g.teamA.players.filter(p => (p.events?.length ?? 0) > 0);
    }
    plan.fresh.forEach(g => {
      linesFor(g).forEach(p => {
        const profile = findProfileForPlayer(profiles, p, g.teamA.players);
        if (!profile) return;
        const entry = byProfile.get(profile.id) ?? { name: profile.name, lines: [] };
        entry.lines.push({ events: p.events, game: g });
        byProfile.set(profile.id, entry);
      });
    });

    const saveKidLines = () => {
      let added = 0;
      byProfile.forEach((entry, kidId) => {
        const profile = profiles.find(p => p.id === kidId);
        if (!profile) return;
        const have = new Set(gamesForKid(kidId).map(g => g.id));
        const entries = entry.lines.map(({ events, game }) => {
          const ev = events ?? [];
          const g = {
            date: game.date,
            opponent: game.teamB.name !== 'Opponent' ? game.teamB.name : undefined,
            teamScore: { us: game.finalA, them: game.finalB },
            events: ev,
            totals: totalsFromEvents(ev),
          };
          return toGameEntry(
            { ...g, fingerprint: fingerprintGame(profile.name, g) },
            kidId,
            profileSeason(profile),
          );
        }).filter(e => !have.has(e.id));
        if (entries.length) added += importGames(entries);
      });
      return added;
    };

    const finish = (withKids: boolean) => {
      toArchivedGames(plan.fresh).forEach(archiveGame);
      const kidsAdded = withKids ? saveKidLines() : 0;
      const names = Array.from(byProfile.values()).map(v => v.name).join(', ');
      Alert.alert(
        'Imported',
        `${plan.fresh.length} game${plan.fresh.length === 1 ? '' : 's'} added to ${file.team.name}.` +
          (plan.alreadyHave > 0 ? `\n\n${plan.alreadyHave} already on this phone.` : '') +
          (kidsAdded > 0 ? `\n\n${kidsAdded} also saved to ${names}.` : ''),
        [{ text: 'OK', onPress: done }],
      );
    };

    const span = plan.fresh.length > 1
      ? `${formatDate(plan.fresh[0].date)} – ${formatDate(plan.fresh[plan.fresh.length - 1].date)}`
      : formatDate(plan.fresh[0].date);
    const kidNote = byProfile.size
      ? `\n\n${Array.from(byProfile.values()).map(v => v.name).join(', ')} ` +
        `${byProfile.size === 1 ? 'has' : 'have'} a My Kid profile here — those lines can go there too.`
      : '';

    Alert.alert(
      `Import ${file.team.name}'s season?`,
      `${plan.fresh.length} game${plan.fresh.length === 1 ? '' : 's'} (${span}).` +
        (plan.alreadyHave > 0 ? ` ${plan.alreadyHave} already here will be skipped.` : '') +
        kidNote,
      [
        { text: 'Cancel', style: 'cancel', onPress: done },
        ...(byProfile.size
          ? [
              { text: 'Season Only', onPress: () => finish(false) },
              { text: 'Season + Kids', onPress: () => finish(true) },
            ]
          : [{ text: 'Import', onPress: () => finish(false) }]),
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <ActivityIndicator color="#C8A040" />
        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  status: { color: '#8B6914', fontSize: 13, textAlign: 'center' },
});
