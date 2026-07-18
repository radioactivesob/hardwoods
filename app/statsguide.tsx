import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { STAT_DEFS, STAT_ORDER } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

// Parent-in-the-stands definitions: what the stat means and exactly
// when to tap it. Written for whoever ends up holding the phone.
const GUIDE: Record<string, { what: string; tapWhen: string }> = {
  points2: {
    what: 'A made basket from inside the three-point line — worth two points.',
    tapWhen: 'Her shot goes in from inside the arc.',
  },
  miss2: {
    what: 'A missed shot attempt from inside the arc. Tracking misses is what makes shooting percentages possible.',
    tapWhen: 'She shoots from inside the arc and it doesn\'t go in.',
  },
  points3: {
    what: 'A made basket from behind the three-point line — worth three points.',
    tapWhen: 'Her shot goes in from behind the arc.',
  },
  miss3: {
    what: 'A missed three-point attempt. Pairs with MADE 3 for her three-point percentage.',
    tapWhen: 'She shoots a three and it doesn\'t go in.',
  },
  ftMade: {
    what: 'A made free throw — the uncontested shot from the line after a foul, worth one point.',
    tapWhen: 'Her free throw goes in.',
  },
  ftMiss: {
    what: 'A missed free throw. Pairs with FT MADE for her free-throw percentage.',
    tapWhen: 'Her free throw doesn\'t go in.',
  },
  rebound: {
    what: 'Grabbing the ball after a missed shot — at either end of the floor. Effort stat number one.',
    tapWhen: 'She comes down with a missed shot.',
  },
  steal: {
    what: 'Taking the ball away from the other team — picking off a pass or stripping a dribbler.',
    tapWhen: 'She takes the ball from an opponent.',
  },
  assist: {
    what: 'A pass that leads directly to a teammate\'s made basket — the catch-and-score kind, not just any pass.',
    tapWhen: 'Her pass sets up a bucket on the next play.',
  },
  block: {
    what: 'Deflecting an opponent\'s shot attempt — sending it away or straight down.',
    tapWhen: 'She gets a hand on their shot.',
  },
  turnover: {
    what: 'Losing the ball to the other team — a bad pass, a travel, a double dribble, or getting stripped.',
    tapWhen: 'Her team loses possession because of her play.',
  },
  foul: {
    what: 'A personal foul called by the referee. The app tracks foul trouble in scorekeeper mode too — here it\'s just her count.',
    tapWhen: 'The whistle blows on her.',
  },
};

export default function StatsGuide() {
  useAllOrientations();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>STAT GUIDE</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>THE HEADLINE: POINTS</Text>
          <Text style={styles.introText}>
            Twos, threes, and free throws added up — the big number during a game
            and the one on the share card.
          </Text>
          <View style={styles.introDivider} />
          <Text style={styles.introTitle}>SHOOTING PERCENTAGES</Text>
          <Text style={styles.introText}>
            FG%, 3PT%, and FT% each need makes AND misses tracked — that's why the
            MISS tiles exist. Track only makes and the percentages stay blank; the
            counting stats still work fine.
          </Text>
        </View>

        {STAT_ORDER.map(key => {
          const def = STAT_DEFS[key];
          const guide = GUIDE[key];
          if (!guide) return null;
          return (
            <View key={key} style={[styles.statCard, def.negative && styles.statCardNegative]}>
              <View style={styles.statHeader}>
                <Text style={[styles.statLabel, def.negative && styles.statLabelNegative]}>
                  {def.label}
                </Text>
                {def.points > 0 && (
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsBadgeText}>+{def.points} PT{def.points > 1 ? 'S' : ''}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statWhat}>{guide.what}</Text>
              <Text style={styles.statTapWhen}>Tap it when: {guide.tapWhen}</Text>
            </View>
          );
        })}

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
  scrollContent: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  introCard: {
    backgroundColor: '#0D0700', borderRadius: 10, borderWidth: 1, borderColor: '#3D2800',
    padding: 16, marginBottom: 16,
  },
  introTitle: { color: '#C8A040', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  introText: { color: '#999', fontSize: 13, lineHeight: 19 },
  introDivider: { height: 1, backgroundColor: '#2A1A00', marginVertical: 14 },
  statCard: {
    backgroundColor: '#0D0700', borderRadius: 10, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginBottom: 10,
  },
  statCardNegative: { borderColor: '#4A1717' },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statLabel: { color: '#C8A040', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  statLabelNegative: { color: '#C25E5E' },
  pointsBadge: {
    backgroundColor: '#3D2800', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  pointsBadgeText: { color: '#C8A040', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statWhat: { color: '#999', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  statTapWhen: { color: '#666', fontSize: 12, fontStyle: 'italic' },
});
