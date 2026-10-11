import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKidStats } from '../hooks/useKidStats';
import { useTraining } from '../hooks/useTraining';
import { profileSeason } from '../hooks/kidStats';
import { matchProfile, toGameEntry } from '../hooks/kidTransfer';
import { parseProfileBackup, planRestore, toSession } from '../hooks/profileBackup';
import { useAllOrientations } from '../hooks/useScreenOrientation';

/**
 * Restore a whole-profile backup. kidimport reads the file and routes here
 * when the format says so, the same way team games go to teamimport.
 *
 * Restores are additive and idempotent: everything already on the phone is
 * skipped by fingerprint, so restoring an old backup after a few more games
 * fills the gaps without touching what's newer.
 */
export default function ProfileImport() {
  useAllOrientations();
  const router = useRouter();
  const { payload } = useLocalSearchParams<{ payload?: string }>();
  const {
    profiles, gamesForKid, importGames, importProfile, loading: kidsLoading,
  } = useKidStats();
  const {
    sessionsForKid, importSessions, importTargets, importDrills, loading: trainingLoading,
  } = useTraining();
  const [status, setStatus] = useState('Reading backup…');
  const ran = useRef(false);

  useEffect(() => {
    if (kidsLoading || trainingLoading || ran.current) return;
    ran.current = true;
    run();
  }, [kidsLoading, trainingLoading]);

  const done = () => router.replace('/mykid');

  const run = () => {
    let json: unknown;
    try {
      json = JSON.parse(payload ?? '');
    } catch {
      Alert.alert('Could Not Read File', "That file couldn't be opened.", [{ text: 'OK', onPress: done }]);
      return;
    }
    const parsed = parseProfileBackup(json);
    if (!parsed.ok) {
      Alert.alert('Could Not Restore', parsed.error, [{ text: 'OK', onPress: done }]);
      return;
    }
    const file = parsed.file;
    const target = matchProfile(file.player, profiles);
    setStatus(`${file.player.name} — ${file.games.length} games, ${file.sessions.length} sessions`);

    const restoreInto = (kidId: string, season: number, created: boolean) => {
      const plan = planRestore(file, gamesForKid(kidId), sessionsForKid(kidId));
      const addedGames = plan.freshGames.length
        ? importGames(plan.freshGames.map(g => toGameEntry(g, kidId, season)))
        : 0;
      const addedSessions = plan.freshSessions.length
        ? importSessions(plan.freshSessions.map(s => toSession(s, kidId)))
        : 0;
      // Drills before targets: a target is meaningless without its drill.
      importDrills(file.drills);
      importTargets(kidId, file.targets);

      const parts = [
        `${addedGames} game${addedGames === 1 ? '' : 's'}`,
        `${addedSessions} session${addedSessions === 1 ? '' : 's'}`,
      ];
      const skipped = plan.haveGames + plan.haveSessions;
      Alert.alert(
        created ? 'Restored' : 'Added',
        `${parts.join(' and ')} added to ${file.player.name}.` +
          (skipped > 0 ? `\n\n${skipped} already on this phone.` : ''),
        [{ text: 'OK', onPress: done }],
      );
    };

    if (!target) {
      Alert.alert(
        `Restore ${file.player.name}?`,
        `You don't have a player called ${file.player.name}. Create the profile and restore ` +
          `${file.games.length} game${file.games.length === 1 ? '' : 's'} and ` +
          `${file.sessions.length} training session${file.sessions.length === 1 ? '' : 's'}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: done },
          {
            text: 'Restore',
            onPress: () => {
              const created = importProfile(file.player);
              restoreInto(created.id, 1, true);
            },
          },
        ],
      );
      return;
    }

    const plan = planRestore(file, gamesForKid(target.id), sessionsForKid(target.id));
    if (plan.freshGames.length === 0 && plan.freshSessions.length === 0) {
      Alert.alert(
        'Nothing New',
        `${target.name} already has everything in that backup.`,
        [{ text: 'OK', onPress: done }],
      );
      return;
    }

    Alert.alert(
      `Add to ${target.name}?`,
      `This backup has ${plan.freshGames.length} game${plan.freshGames.length === 1 ? '' : 's'} and ` +
        `${plan.freshSessions.length} training session${plan.freshSessions.length === 1 ? '' : 's'} ` +
        `${target.name} doesn't have.` +
        (plan.haveGames + plan.haveSessions > 0
          ? `\n\n${plan.haveGames + plan.haveSessions} are already here and will be skipped.`
          : ''),
      [
        { text: 'Cancel', style: 'cancel', onPress: done },
        { text: 'Add', onPress: () => restoreInto(target.id, profileSeason(target), false) },
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
