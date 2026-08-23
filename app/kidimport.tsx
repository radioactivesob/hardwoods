import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import { useKidStats } from '../hooks/useKidStats';
import { profileSeason } from '../hooks/kidStats';
import {
  parseTransfer, planMerge, matchProfile, toGameEntry, TransferGame,
} from '../hooks/kidTransfer';
import { useAllOrientations } from '../hooks/useScreenOrientation';

/**
 * Merging games another parent sent. Reached two ways: the Import button on
 * the My Kid screen (no uri — opens the picker), or iOS handing us a
 * .hardwoods file the user opened from AirDrop or Messages (uri supplied).
 * Both land here so the confirmation logic lives in one place.
 */
export default function KidImport() {
  useAllOrientations();
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const { profiles, gamesForKid, importGames, importProfile, loading } = useKidStats();
  const [status, setStatus] = useState('Reading file…');
  const ran = useRef(false);

  useEffect(() => {
    // Profiles must be loaded before we can match the player.
    if (loading || ran.current) return;
    ran.current = true;
    run();
  }, [loading]);

  const done = () => router.replace('/mykid');

  const run = async () => {
    let json: unknown;
    try {
      if (uri) {
        json = JSON.parse(await new File(uri).text());
      } else {
        setStatus('Choose a file…');
        const picked = await File.pickFileAsync();
        if (picked.canceled || !picked.result) return done();
        json = JSON.parse(await picked.result.text());
      }
    } catch {
      Alert.alert(
        'Could Not Read File',
        "That file couldn't be opened, or isn't Hardwoods data.",
        [{ text: 'OK', onPress: done }],
      );
      return;
    }

    const parsed = parseTransfer(json);
    if (!parsed.ok) {
      Alert.alert('Could Not Import', parsed.error, [{ text: 'OK', onPress: done }]);
      return;
    }
    const file = parsed.file;
    const target = matchProfile(file.player, profiles);
    const count = file.games.length;
    setStatus(`${file.player.name} — ${count} game${count === 1 ? '' : 's'}`);

    // No profile by that name — offer to build one from the file, which also
    // brings across the stat set so both phones stay in step.
    if (!target) {
      Alert.alert(
        `Add ${file.player.name}?`,
        `You don't have a player called ${file.player.name}. Create the profile and add ${count} game${count === 1 ? '' : 's'}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: done },
          {
            text: 'Create & Import',
            onPress: () => {
              const created = importProfile(file.player);
              const added = importGames(file.games.map(g => toGameEntry(g, created.id, 1)));
              Alert.alert(
                'Imported',
                `${file.player.name} added with ${added} game${added === 1 ? '' : 's'}.`,
                [{ text: 'OK', onPress: done }],
              );
            },
          },
        ],
      );
      return;
    }

    const plan = planMerge(file, gamesForKid(target.id), target.id);
    const season = profileSeason(target);
    const parts: string[] = [];
    if (plan.fresh.length) parts.push(`${plan.fresh.length} new game${plan.fresh.length === 1 ? '' : 's'}`);
    if (plan.alreadyHave.length) parts.push(`${plan.alreadyHave.length} already imported`);
    if (plan.possibleOverlap.length) parts.push(
      plan.possibleOverlap.length === 1
        ? '1 that looks like a game you already have'
        : `${plan.possibleOverlap.length} that look like games you already have`,
    );

    if (plan.fresh.length === 0 && plan.possibleOverlap.length === 0) {
      Alert.alert(
        'Nothing New',
        count === 1
          ? 'You already have that game.'
          : `You already have all ${count} games in that file.`,
        [{ text: 'OK', onPress: done }],
      );
      return;
    }

    const addTo = (games: TransferGame[]) => {
      const added = importGames(games.map(g => toGameEntry(g, target.id, season)));
      Alert.alert(
        'Imported',
        `${added} game${added === 1 ? '' : 's'} added to ${target.name}.`,
        [{ text: 'OK', onPress: done }],
      );
    };

    Alert.alert(
      `Import to ${target.name}?`,
      `This file has ${parts.join(', ')}.` +
        (plan.possibleOverlap.length
          ? '\n\nGames on the same day against the same opponent may be the same game tracked twice.'
          : ''),
      [
        { text: 'Cancel', style: 'cancel', onPress: done },
        ...(plan.fresh.length
          ? [{ text: `Add ${plan.fresh.length} New`, onPress: () => addTo(plan.fresh) }]
          : []),
        ...(plan.possibleOverlap.length
          ? [{
              text: `Add All ${plan.fresh.length + plan.possibleOverlap.length}`,
              onPress: () => addTo([...plan.fresh, ...plan.possibleOverlap.map(o => o.incoming)]),
            }]
          : []),
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator color="#C8A040" />
        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  status: { color: '#8B6914', fontSize: 13, fontWeight: '600' },
});
