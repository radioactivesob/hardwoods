import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGame, RulesConfig } from '../context/GameContext';

const PRESETS: Record<string, Partial<RulesConfig>> = {
  standard_youth: {
    numPeriods: 4,
    periodMinutes: 8,
    timeoutsPerHalf: 2,
    timeoutsPerGame: 5,
    foulLimitForBonus: 7,
    overtimeMinutes: 4,
  },
  nfhs: {
    numPeriods: 4,
    periodMinutes: 8,
    timeoutsPerHalf: 3,
    timeoutsPerGame: 5,
    foulLimitForBonus: 7,
    overtimeMinutes: 4,
  },
};

export default function RulesSetup() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const [rules, setRules] = useState<RulesConfig>({ ...state.rules });

  const applyPreset = (preset: 'standard_youth' | 'nfhs' | 'custom') => {
    if (preset !== 'custom') {
      setRules({ ...rules, ...PRESETS[preset], preset });
    } else {
      setRules({ ...rules, preset: 'custom' });
    }
  };

  const save = () => {
    dispatch({ type: 'SET_RULES', rules });
    router.back();
  };

  const numInput = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min = 1,
    max = 99,
  ) => (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputControls}>
        <TouchableOpacity style={styles.stepper} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.stepperText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.inputValue}>{value}</Text>
        <TouchableOpacity style={styles.stepper} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={styles.stepperText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>RULES SETUP</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>SAVE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Presets */}
        <Text style={styles.sectionLabel}>GAME PRESET</Text>
        <View style={styles.presetRow}>
          {(['standard_youth', 'nfhs', 'custom'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.presetBtn, rules.preset === p && styles.presetBtnActive]}
              onPress={() => applyPreset(p)}
            >
              <Text style={[styles.presetBtnText, rules.preset === p && styles.presetBtnTextActive]}>
                {p === 'standard_youth' ? 'STD YOUTH' : p === 'nfhs' ? 'NFHS' : 'CUSTOM'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>GAME STRUCTURE</Text>
        {numInput('Periods / Quarters', rules.numPeriods, v => setRules({ ...rules, numPeriods: v, preset: 'custom' }), 1, 8)}
        {numInput('Period Length (min)', rules.periodMinutes, v => setRules({ ...rules, periodMinutes: v, preset: 'custom' }), 1, 20)}
        {numInput('Overtime Length (min)', rules.overtimeMinutes, v => setRules({ ...rules, overtimeMinutes: v, preset: 'custom' }), 1, 10)}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>TIMEOUTS</Text>
        {numInput('Timeouts Per Half', rules.timeoutsPerHalf, v => setRules({ ...rules, timeoutsPerHalf: v, preset: 'custom' }), 0, 10)}
        {numInput('Timeouts Per Game', rules.timeoutsPerGame, v => setRules({ ...rules, timeoutsPerGame: v, preset: 'custom' }), 0, 20)}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>FOULS</Text>
        {numInput('Team Fouls for Bonus', rules.foulLimitForBonus, v => setRules({ ...rules, foulLimitForBonus: v, preset: 'custom' }), 1, 15)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0F00',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0700',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#8B6914',
  },
  backText: {
    color: '#8B6914',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  saveBtn: {
    backgroundColor: '#8B6914',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  sectionLabel: {
    color: '#8B6914',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#2A1A00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3D2800',
  },
  presetBtnActive: {
    backgroundColor: '#8B6914',
    borderColor: '#C8A040',
  },
  presetBtnText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  presetBtnTextActive: {
    color: '#FFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A1A00',
    marginVertical: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A0F00',
  },
  inputLabel: {
    color: '#CCC',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  inputControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  stepper: {
    width: 36,
    height: 36,
    backgroundColor: '#2A1A00',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3D2800',
  },
  stepperText: {
    color: '#C8A040',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  inputValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    width: 48,
    textAlign: 'center',
  },
});
