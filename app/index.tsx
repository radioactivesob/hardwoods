import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAllOrientations } from '../hooks/useScreenOrientation';

export default function Home() {
  useAllOrientations();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.brand}>HARDWOODS</Text>
        <Text style={styles.tagline}>Youth basketball, in the book.</Text>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/scoreboard')} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>📋</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>FULL SCOREBOOK</Text>
            <Text style={styles.cardDesc}>
              Run the official book — rosters, per-player stats, fouls, periods, the works.
            </Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/mykid')} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>⭐</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>MY KID</Text>
            <Text style={styles.cardDesc}>
              Track your kid from the stands and watch their season take shape.
            </Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/simplegame')} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>🏀</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>SIMPLE SCOREBOOK</Text>
            <Text style={styles.cardDesc}>
              Just the score — two teams, no roster, tap to record team points and fouls.
            </Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/teamseasons')} activeOpacity={0.8}>
          <Text style={styles.cardIcon}>📈</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>TEAM SEASONS</Text>
            <Text style={styles.cardDesc}>
              Archived scorebook games — records, trends, and player season averages.
            </Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  content: {
    flex: 1, justifyContent: 'center', padding: 24,
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
