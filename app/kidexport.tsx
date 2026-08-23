import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { Text } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useKidStats } from '../hooks/useKidStats';
import { pointsFromTotals, kidColor, gameSeason, profileSeason } from '../hooks/kidStats';
import { buildTransfer, suggestFileName } from '../hooks/kidTransfer';
import { useAllOrientations } from '../hooks/useScreenOrientation';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KidExport() {
  useAllOrientations();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId: string }>();
  const { profiles, gamesForKid } = useKidStats();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const profile = profiles.find(p => p.id === kidId) ?? null;
  if (!profile) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const games = [...gamesForKid(profile.id)].reverse(); // newest first
  const allSelected = games.length > 0 && selected.size === games.length;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const send = async () => {
    const picked = games.filter(g => selected.has(g.id));
    if (picked.length === 0) return;
    try {
      setSending(true);
      const payload = buildTransfer(profile, picked);
      const name = suggestFileName(payload.player, picked.length);
      const file = new File(Paths.cache, name);
      // Same filename twice in a day is normal — overwrite rather than fail.
      file.create({ overwrite: true });
      file.write(JSON.stringify(payload));

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing Unavailable', 'This device cannot open the share sheet.');
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: `${profile.name} — ${picked.length} game${picked.length === 1 ? '' : 's'}`,
        UTI: 'public.json',
      });
    } catch {
      Alert.alert('Export Failed', 'Could not create the file. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SHARE GAMES</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.introText}>
          Pick the games to send. The file also carries {profile.name}'s number,
          colour, and which stats you track — so whoever opens it records the
          same things you do.
        </Text>
      </View>

      {games.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptyHint}>
            Track a game for {profile.name} and you'll be able to send it from here.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <TouchableOpacity
              style={styles.selectAll}
              onPress={() => setSelected(allSelected ? new Set() : new Set(games.map(g => g.id)))}
            >
              <Text style={[styles.selectAllText, { color: accent }]}>
                {allSelected ? 'CLEAR ALL' : `SELECT ALL ${games.length}`}
              </Text>
            </TouchableOpacity>

            {games.map(g => {
              const on = selected.has(g.id);
              const pts = pointsFromTotals(g.totals);
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.row, on && { borderColor: accent }]}
                  onPress={() => toggle(g.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.check, on && { backgroundColor: accent, borderColor: accent }]}>
                    {on && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {formatDate(g.date)}{g.opponent ? ` · vs. ${g.opponent}` : ''}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {pts} pts · {g.events.length} stat{g.events.length === 1 ? '' : 's'}
                      {gameSeason(g) !== profileSeason(profile) ? ` · season ${gameSeason(g)}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: selected.size > 0 ? accent : '#2A1A00' },
                sending && { opacity: 0.6 },
              ]}
              onPress={selected.size > 0 && !sending ? send : undefined}
            >
              <Text style={[styles.sendText, selected.size === 0 && { color: '#555' }]}>
                {sending
                  ? 'PREPARING…'
                  : selected.size === 0
                    ? 'SELECT GAMES TO SEND'
                    : `SHARE ${selected.size} GAME${selected.size === 1 ? '' : 'S'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
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
  intro: { paddingHorizontal: 16, paddingTop: 14 },
  introText: { color: '#8B6914', fontSize: 12, lineHeight: 17 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scroll: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  selectAll: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 4 },
  selectAllText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 12, marginBottom: 8,
  },
  check: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: '#3D2800',
    justifyContent: 'center', alignItems: 'center',
  },
  checkMark: { color: '#1A0F00', fontSize: 15, fontWeight: '900' },
  rowTitle: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  rowMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#2A1A00', backgroundColor: '#0D0700',
  },
  sendBtn: { borderRadius: 10, paddingVertical: 15, alignItems: 'center' },
  sendText: { color: '#1A0F00', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
});
