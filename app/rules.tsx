import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGame, RulesConfig, SavedPreset } from '../context/GameContext';

export default function RulesSetup() {
  const router = useRouter();
  const { state, dispatch } = useGame();
  const [rules, setRules] = useState<RulesConfig>({ ...state.rules });
  const [presetNames, setPresetNames] = useState<[string, string]>([
    state.presets[0].name,
    state.presets[1].name,
  ]);

  const loadPreset = (index: 0 | 1) => {
    const p = state.presets[index];
    setRules({ ...p, preset: index === 0 ? 'preset1' : 'preset2' });
  };

  const savePreset = (index: 0 | 1) => {
    const preset: SavedPreset = {
      name: presetNames[index],
      numPeriods: rules.numPeriods,
      periodMinutes: rules.periodMinutes,
      timeoutsPerHalf: rules.timeoutsPerHalf,
      timeoutsPerGame: rules.timeoutsPerGame,
      foulLimitForBonus: rules.foulLimitForBonus,
      overtimeMinutes: rules.overtimeMinutes,
      personalFoulLimit: rules.personalFoulLimit,
      foulsResetAtHalf: rules.foulsResetAtHalf,
      technicalFoulShots: rules.technicalFoulShots,
      playerTechIsPersonalFoul: rules.playerTechIsPersonalFoul,
    };
    dispatch({ type: 'SAVE_PRESET', index, preset });
    Alert.alert('Saved', `"${preset.name}" preset saved.`);
  };

  const save = () => {
    dispatch({ type: 'SET_RULES', rules });
    router.back();
  };

  const update = (field: keyof RulesConfig, value: any) =>
    setRules(r => ({ ...r, [field]: value, preset: 'custom' }));

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

  const toggleRow = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={styles.inputRow}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.toggleBtn, value && styles.toggleBtnOn]}
        onPress={() => onChange(!value)}
      >
        <Text style={[styles.toggleText, value && styles.toggleTextOn]}>
          {value ? 'YES' : 'NO'}
        </Text>
      </TouchableOpacity>
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

        <Text style={styles.sectionLabel}>SAVED PRESETS</Text>
        {([0, 1] as const).map(i => (
          <View key={i} style={[styles.presetCard, rules.preset === (i === 0 ? 'preset1' : 'preset2') && styles.presetCardActive]}>
            <TextInput
              style={styles.presetNameInput}
              value={presetNames[i]}
              onChangeText={v => setPresetNames(prev => {
                const next: [string, string] = [...prev] as [string, string];
                next[i] = v;
                return next;
              })}
              placeholder={`Preset ${i + 1} Name`}
              placeholderTextColor="#444"
            />
            <View style={styles.presetActions}>
              <TouchableOpacity style={styles.presetLoadBtn} onPress={() => loadPreset(i)}>
                <Text style={styles.presetLoadText}>LOAD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.presetSaveBtn} onPress={() => savePreset(i)}>
                <Text style={styles.presetSaveText}>SAVE HERE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>GAME STRUCTURE</Text>
        {numInput('Periods / Quarters', rules.numPeriods, v => update('numPeriods', v), 1, 8)}
        {numInput('Period Length (min)', rules.periodMinutes, v => update('periodMinutes', v), 1, 20)}
        {numInput('Overtime Length (min)', rules.overtimeMinutes, v => update('overtimeMinutes', v), 1, 10)}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>TIMEOUTS</Text>
        {numInput('Timeouts Per Half', rules.timeoutsPerHalf, v => update('timeoutsPerHalf', v), 0, 10)}
        {numInput('Timeouts Per Game', rules.timeoutsPerGame, v => update('timeoutsPerGame', v), 0, 20)}

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>FOULS</Text>
        {numInput('Team Fouls for Bonus', rules.foulLimitForBonus, v => update('foulLimitForBonus', v), 1, 15)}
        {numInput('Personal Foul Limit', rules.personalFoulLimit, v => update('personalFoulLimit', v), 1, 6)}
        {numInput('Technical Foul Free Throws', rules.technicalFoulShots, v => update('technicalFoulShots', v), 1, 3)}
        {toggleRow('Player Tech = Personal Foul', rules.playerTechIsPersonalFoul, v => update('playerTechIsPersonalFoul', v))}
        {toggleRow('Player Fouls Reset at Half', rules.foulsResetAtHalf, v => update('foulsResetAtHalf', v))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
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
  backText: { color: '#8B6914', fontSize: 13, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  saveBtn: { backgroundColor: '#8B6914', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  saveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  sectionLabel: {
    color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginTop: 4,
  },
  presetCard: {
    backgroundColor: '#0D0700',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A1A00',
    padding: 10,
    marginBottom: 8,
  },
  presetCardActive: { borderColor: '#8B6914' },
  presetNameInput: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#2A1A00',
    paddingBottom: 6,
    marginBottom: 8,
  },
  presetActions: { flexDirection: 'row', gap: 8 },
  presetLoadBtn: {
    flex: 1, backgroundColor: '#2A1A00', borderRadius: 6, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#3D2800',
  },
  presetLoadText: { color: '#C8A040', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  presetSaveBtn: {
    flex: 1, backgroundColor: '#3A2800', borderRadius: 6, paddingVertical: 8,
    alignItems: 'center', borderWidth: 1, borderColor: '#8B6914',
  },
  presetSaveText: { color: '#C8A040', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#2A1A00', marginVertical: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A0F00',
  },
  inputLabel: { color: '#CCC', fontSize: 14, fontWeight: '600', flex: 1 },
  inputControls: { flexDirection: 'row', alignItems: 'center' },
  stepper: {
    width: 36, height: 36, backgroundColor: '#2A1A00', borderRadius: 6,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3D2800',
  },
  stepperText: { color: '#C8A040', fontSize: 20, fontWeight: '700', lineHeight: 24 },
  inputValue: { color: '#FFF', fontSize: 18, fontWeight: '800', width: 48, textAlign: 'center' },
  toggleBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6,
    backgroundColor: '#2A1A00', borderWidth: 1, borderColor: '#3D2800',
  },
  toggleBtnOn: { backgroundColor: '#3A5A1A', borderColor: '#6A9A2A' },
  toggleText: { color: '#666', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  toggleTextOn: { color: '#9ACA4A' },
});
