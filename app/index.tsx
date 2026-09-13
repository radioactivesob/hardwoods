import React from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
} from 'react-native';
import { Text } from '../components/AppText';
import { useRouter } from 'expo-router';
import { useAllOrientations } from '../hooks/useScreenOrientation';

// Stat tracking leads; the scorebooks follow. The app started as a scorebook,
// but tracking a kid — and now a team — is what people actually open it for.
const MODES: { path: string; icon: string; title: string; desc: string }[] = [
  { path: '/mykid', icon: '⭐', title: 'MY KID',
    desc: 'Track your kid from the stands and watch their season take shape.' },
  { path: '/teamstats', icon: '📊', title: 'TEAM STATS',
    desc: 'Every player on your roster, one tap per stat — no opponent, no book.' },
  { path: '/training', icon: '🎯', title: 'TRAINING',
    desc: 'Run shooting drills, chart every shot, and watch the percentages climb.' },
  { path: '/scoreboard', icon: '📋', title: 'FULL SCOREBOOK',
    desc: 'Run the official book — rosters, per-player stats, fouls, periods, the works.' },
  { path: '/simplegame', icon: '🏀', title: 'SIMPLE SCOREBOOK',
    desc: 'Just the score — two teams, no roster, tap to record team points and fouls.' },
  { path: '/teamseasons', icon: '📈', title: 'TEAM SEASONS',
    desc: 'Every archived team game — records, trends, and player season averages.' },
];

export default function Home() {
  useAllOrientations();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* The wordmark shrinks rather than wrapping mid-word at large
            accessibility text sizes. */}
        <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit>
          HARDWOODS
        </Text>
        <Text style={styles.tagline}>Every game. Every stat. From the stands.</Text>

        {MODES.map(m => (
          <TouchableOpacity
            key={m.path}
            style={styles.card}
            onPress={() => router.push(m.path as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>{m.icon}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{m.title}</Text>
              <Text style={styles.cardDesc}>{m.desc}</Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  // Six cards no longer fit every phone; centre when they do, scroll when not.
  content: {
    flexGrow: 1, justifyContent: 'center', padding: 24,
    maxWidth: 560, width: '100%', alignSelf: 'center',
  },
  brand: {
    color: '#C8A040', fontSize: 34, fontWeight: '900', letterSpacing: 6,
    textAlign: 'center',
  },
  tagline: {
    color: '#666', fontSize: 13, fontStyle: 'italic', textAlign: 'center',
    marginTop: 6, marginBottom: 36,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0D0700', borderRadius: 12,
    borderWidth: 1, borderColor: '#3D2800',
    padding: 18, marginBottom: 12,
  },
  cardIcon: { fontSize: 28 },
  cardBody: { flex: 1 },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  cardDesc: { color: '#8B6914', fontSize: 12, lineHeight: 17 },
  cardChevron: { color: '#8B6914', fontSize: 26, fontWeight: '300' },
});
