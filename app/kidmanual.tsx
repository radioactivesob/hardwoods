import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useKidStats } from '../hooks/useKidStats';
import {
  STAT_DEFS, StatKey, StatEvent, pointsFromTotals, emptyTotals, kidColor,
} from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const DAY = 86400000;

function formatDate(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const isYesterday = d.toDateString() === new Date(Date.now() - DAY).toDateString();
  const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return isToday ? `${label} (today)` : isYesterday ? `${label} (yesterday)` : label;
}

/**
 * Enter a game that was never tracked live — from a paper book, a coach
 * reading stats aloud, or a parent without the app. Counts are turned into
 * events so the record is shaped like every other game.
 */
export default function KidManual() {
  useAllOrientations();
  const router = useRouter();
  const { kidId } = useLocalSearchParams<{ kidId: string }>();
  const { profiles, saveGame } = useKidStats();

  const [date, setDate] = useState(Date.now());
  const [opponent, setOpponent] = useState('');
  const [us, setUs] = useState('');
  const [them, setThem] = useState('');
  const [counts, setCounts] = useState<Partial<Record<StatKey, number>>>({});

  const profile = profiles.find(p => p.id === kidId) ?? null;
  if (!profile) return <SafeAreaView style={styles.container} />;

  const accent = kidColor(profile);
  const stats = profile.enabledStats;

  const totals = { ...emptyTotals() };
  stats.forEach(k => { totals[k] = counts[k] ?? 0; });
  const points = pointsFromTotals(totals);
  const recorded = stats.reduce((n, k) => n + (counts[k] ?? 0), 0);

  const bump = (key: StatKey, delta: number) => {
    setCounts(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) }));
  };

  const save = () => {
    if (recorded === 0) {
      Alert.alert('Nothing Entered', 'Add at least one stat before saving.');
      return;
    }
    // Synthesise an event log from the counts so this game behaves like a
    // tracked one everywhere else in the app.
    const events: StatEvent[] = [];
    let t = date;
    stats.forEach(key => {
      for (let i = 0; i < (counts[key] ?? 0); i++) {
        t += 1000;
        events.push({ key, at: t });
      }
    });

    const hasScore = us.trim() !== '' && them.trim() !== '';
    saveGame(profile.id, events, {
      date,
      opponent: opponent.trim() || undefined,
      teamScore: hasScore
        ? { us: parseInt(us, 10) || 0, them: parseInt(them, 10) || 0 }
        : undefined,
    });
    Alert.alert(
      'Game Added',
      `${points} point${points === 1 ? '' : 's'} recorded for ${profile.name}.`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← CANCEL</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ADD GAME</Text>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }]} onPress={save}>
          <Text style={styles.saveBtnText}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          For a game you didn't track live — from a paper book, or stats someone
          read out to you.
        </Text>

        <Text style={styles.label}>WHEN</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setDate(d => d - DAY)}>
            <Text style={styles.dateBtnText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          <TouchableOpacity
            style={[styles.dateBtn, date >= Date.now() - DAY / 2 && styles.dateBtnOff]}
            onPress={() => setDate(d => Math.min(d + DAY, Date.now()))}
          >
            <Text style={styles.dateBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>OPPONENT (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={opponent}
          onChangeText={setOpponent}
          placeholder="Team name"
          placeholderTextColor="#444"
        />

        <Text style={styles.label}>FINAL TEAM SCORE (OPTIONAL)</Text>
        <View style={styles.scoreRow}>
          <View style={styles.scoreCol}>
            <Text style={[styles.scoreLabel, { color: accent }]}>US</Text>
            <TextInput
              style={[styles.scoreInput, { borderColor: accent }]}
              value={us} onChangeText={setUs}
              keyboardType="number-pad" maxLength={3}
              placeholder="0" placeholderTextColor="#444"
            />
          </View>
          <Text style={styles.dash}>—</Text>
          <View style={styles.scoreCol}>
            <Text style={styles.scoreLabel}>THEM</Text>
            <TextInput
              style={styles.scoreInput}
              value={them} onChangeText={setThem}
              keyboardType="number-pad" maxLength={3}
              placeholder="0" placeholderTextColor="#444"
            />
          </View>
        </View>

        <View style={styles.pointsBar}>
          <Text style={[styles.pointsValue, { color: accent }]}>{points}</Text>
          <Text style={styles.pointsLabel}>POINTS</Text>
        </View>

        <Text style={styles.label}>STATS</Text>
        {stats.map(key => {
          const def = STAT_DEFS[key];
          const n = counts[key] ?? 0;
          return (
            <View key={key} style={[styles.statRow, def.negative && styles.statRowNegative]}>
              <Text style={[styles.statLabel, def.negative && { color: '#C25E5E' }]}>
                {def.label}
              </Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[styles.stepBtn, n === 0 && styles.stepBtnOff]}
                  onPress={() => bump(key, -1)}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stepValue, { color: n > 0 ? accent : '#555' }]}>{n}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => bump(key, 1)}>
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
    </KeyboardAvoidingView>
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
  saveBtn: { borderRadius: 6, paddingHorizontal: 16, paddingVertical: 7 },
  saveBtnText: { color: '#1A0F00', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  scroll: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  intro: { color: '#8B6914', fontSize: 12, lineHeight: 17, marginBottom: 18 },
  label: {
    color: '#8B6914', fontSize: 10, fontWeight: '800', letterSpacing: 1.5,
    marginBottom: 8, marginTop: 14,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBtn: {
    width: 44, height: 40, borderRadius: 8, backgroundColor: '#0D0700',
    borderWidth: 1, borderColor: '#3D2800', justifyContent: 'center', alignItems: 'center',
  },
  dateBtnOff: { opacity: 0.3 },
  dateBtnText: { color: '#C8A040', fontSize: 15, fontWeight: '900' },
  dateText: { color: '#FFF', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
  input: {
    backgroundColor: '#0D0700', color: '#FFF', borderWidth: 1, borderColor: '#2A1A00',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontWeight: '600',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreCol: { alignItems: 'center', gap: 6, flex: 1 },
  scoreLabel: { color: '#8B6914', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  scoreInput: {
    backgroundColor: '#0D0700', color: '#FFF', borderWidth: 1, borderColor: '#3D2800',
    borderRadius: 8, alignSelf: 'stretch', paddingVertical: 10,
    fontSize: 22, fontWeight: '900', textAlign: 'center',
  },
  dash: { color: '#555', fontSize: 18, fontWeight: '700', marginTop: 18 },
  pointsBar: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 10,
    backgroundColor: '#0D0700', borderRadius: 10, borderWidth: 1, borderColor: '#2A1A00',
    paddingVertical: 14, marginTop: 20,
  },
  pointsValue: { fontSize: 34, fontWeight: '900' },
  pointsLabel: { color: '#8B6914', fontSize: 12, fontWeight: '700', letterSpacing: 3 },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8,
  },
  statRowNegative: { borderColor: '#4A1717' },
  statLabel: { color: '#C8A040', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#1A0F00',
    borderWidth: 1, borderColor: '#3D2800', justifyContent: 'center', alignItems: 'center',
  },
  stepBtnOff: { opacity: 0.35 },
  stepBtnText: { color: '#C8A040', fontSize: 20, fontWeight: '900' },
  stepValue: { fontSize: 20, fontWeight: '900', minWidth: 34, textAlign: 'center' },
});
