import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamGames } from '../hooks/useTeamGames';
import { useKidStats } from '../hooks/useKidStats';
import { findProfileForPlayer, profileSeason, totalsFromEvents } from '../hooks/kidStats';
import { fingerprintGame, toGameEntry } from '../hooks/kidTransfer';
import { parseTeamTransfer, alreadyArchived, toArchivedGame } from '../hooks/teamTransfer';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Merge a team game another phone sent. kidimport reads the file and hands
 * the JSON here when it's a team game, so the confirmation logic for each
 * file type stays in its own place.
 *
 * Two things happen on import: the game joins Team Seasons, and any player
 * on it with a My Kid profile on this phone is offered her line — the same
 * matching a live game uses, so Cynthia tracking the team on her phone can
 * feed Evelyn's season on this one.
 */
export default function TeamImport() {
  useAllOrientations();
  const router = useRouter();
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  const { games, archiveGame, loading: archiveLoading } = useTeamGames();
  const { profiles, gamesForKid, importGames, loading: kidsLoading } = useKidStats();
  const [status, setStatus] = useState('Reading file…');
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
    const parsed = parseTeamTransfer(json);
    if (!parsed.ok) {
      Alert.alert('Could Not Import', parsed.error, [{ text: 'OK', onPress: done }]);
      return;
    }
    const file = parsed.file;
    const g = file.game;
    const title = `${g.teamA.name} ${g.finalA}–${g.finalB} ${g.teamB.name}`;
    setStatus(`${title} · ${formatDate(g.date)}`);

    if (alreadyArchived(file, games)) {
      Alert.alert('Nothing New', 'You already have that game in Team Seasons.', [{ text: 'OK', onPress: done }]);
      return;
    }

    // Lines that belong to a kid profile on this phone.
    const matches = g.teamA.players
      .filter(p => (p.events?.length ?? 0) > 0)
      .map(p => ({ p, profile: findProfileForPlayer(profiles, p, g.teamA.players) }))
      .filter((m): m is { p: typeof m.p; profile: NonNullable<typeof m.profile> } => !!m.profile);

    const saveKidLines = () => {
      let added = 0;
      matches.forEach(({ p, profile }) => {
        const events = p.events ?? [];
        const game = {
          date: g.date,
          opponent: g.teamB.name !== 'Opponent' ? g.teamB.name : undefined,
          teamScore: { us: g.finalA, them: g.finalB },
          events,
          totals: totalsFromEvents(events),
        };
        // Content-derived id, so the same game arriving twice can't double
        // her season — and so it lines up with a kidgames file of the same game.
        const entry = toGameEntry(
          { ...game, fingerprint: fingerprintGame(profile.name, game) },
          profile.id,
          profileSeason(profile),
        );
        const have = new Set(gamesForKid(profile.id).map(k => k.id));
        if (!have.has(entry.id)) added += importGames([entry]);
      });
      return added;
    };

    const finish = (withKids: boolean) => {
      archiveGame(toArchivedGame(file));
      const kidsAdded = withKids ? saveKidLines() : 0;
      const names = matches.map(m => m.profile.name).join(', ');
      Alert.alert(
        'Imported',
        `${title} added to Team Seasons.` +
          (kidsAdded > 0 ? `\n\nAlso saved to ${names}.` : ''),
        [{ text: 'OK', onPress: done }],
      );
    };

    const kidNote = matches.length
      ? `\n\n${matches.map(m => m.profile.name).join(', ')} ${matches.length === 1 ? 'has' : 'have'} a My Kid profile here — her line can go there too.`
      : '';

    Alert.alert(
      `Import ${g.teamA.name}'s game?`,
      `${title}, ${formatDate(g.date)}. ${g.teamA.players.length} player${g.teamA.players.length === 1 ? '' : 's'}.${kidNote}`,
      [
        { text: 'Cancel', style: 'cancel', onPress: done },
        ...(matches.length
          ? [
              { text: 'Team Only', onPress: () => finish(false) },
              { text: `Team + ${matches.length === 1 ? matches[0].profile.name : 'Kids'}`, onPress: () => finish(true) },
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
