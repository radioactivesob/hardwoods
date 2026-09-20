import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTeamLibrary } from '../hooks/useTeamLibrary';
import { byJersey } from '../hooks/teamStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const COLORS = [
  '#1E90FF', '#FF4500', '#32CD32', '#FF1493',
  '#FFD700', '#9400D3', '#FF6600', '#00CED1',
  '#FF0000', '#00FF7F', '#FF69B4', '#FFFFFF',
];

/**
 * The roster, edited in place. This is the same saved team the Full
 * Scorebook loads, but without the scorebook's ideas — no Team A/B slot, no
 * starters, and no separate save step. Every keystroke lands in the library,
 * which is what makes "she wasn't in the list" impossible to cause by
 * forgetting a button.
 */
export default function TeamRoster() {
  useAllOrientations();
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { library, loading, updateTeam, deleteTeam } = useTeamLibrary();
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');

  const team = library.find(t => t.id === teamId) ?? null;
  if (loading || !team) return <SafeAreaView style={styles.container} />;

  const color = team.color;
  const players = team.players.map((p, i) => ({ ...p, i })).sort(byJersey);

  const setPlayer = (i: number, changes: { name?: string; number?: string }) => {
    updateTeam(team.id, t => ({
      ...t,
      players: t.players.map((p, idx) => (idx === i ? { ...p, ...changes } : p)),
    }));
  };

  const removePlayer = (i: number) => {
    const p = team.players[i];
    Alert.alert(
      `Remove #${p.number || '?'} ${p.name || 'this player'}?`,
      "She'll be taken off the roster. Games already saved keep her line.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: () => updateTeam(team.id, t => ({ ...t, players: t.players.filter((_, idx) => idx !== i) })),
        },
      ],
    );
  };

  const add = () => {
    if (!newName.trim() && !newNumber.trim()) return;
    updateTeam(team.id, t => ({
      ...t,
      players: [...t.players, { name: newName.trim(), number: newNumber.trim(), isStarting: false }],
    }));
    setNewName('');
    setNewNumber('');
  };

  const remove = () => {
    Alert.alert(
      `Delete ${team.name}?`,
      'The roster is removed. Saved games in Team Seasons are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Team', style: 'destructive', onPress: () => { deleteTeam(team.id); router.back(); } },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← DONE</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ROSTER</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>TEAM</Text>
        <TextInput
          style={[styles.teamName, { color }]}
          value={team.name}
          onChangeText={v => updateTeam(team.id, t => ({ ...t, name: v }))}
          placeholder="Team name"
          placeholderTextColor="#444"
        />
        <View style={styles.colorRow}>
          {COLORS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
              onPress={() => updateTeam(team.id, t => ({ ...t, color: c }))}
            />
          ))}
        </View>

        <Text style={styles.label}>PLAYERS ({players.length})</Text>
        <Text style={styles.hint}>Changes save as you type. Sorted by number.</Text>
        {players.map(p => (
          <View key={p.i} style={styles.row}>
            <TextInput
              style={[styles.numInput, { color }]}
              value={p.number}
              onChangeText={v => setPlayer(p.i, { number: v.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="#"
              placeholderTextColor="#444"
            />
            <TextInput
              style={styles.nameInput}
              value={p.name}
              onChangeText={v => setPlayer(p.i, { name: v })}
              placeholder="Name"
              placeholderTextColor="#444"
            />
            <TouchableOpacity style={styles.removeBtn} onPress={() => removePlayer(p.i)}>
              <Text style={styles.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={[styles.row, styles.addRow, { borderColor: color }]}>
          <TextInput
            style={[styles.numInput, { color }]}
            value={newNumber}
            onChangeText={v => setNewNumber(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="#"
            placeholderTextColor="#444"
          />
          <TextInput
            style={styles.nameInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Add a player"
            placeholderTextColor="#666"
            onSubmitEditing={add}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: newName.trim() || newNumber.trim() ? color : '#2A1A00' }]}
            onPress={add}
          >
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.deleteRow} onPress={remove}>
          <Text style={styles.deleteRowText}>DELETE TEAM</Text>
        </TouchableOpacity>
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
  scroll: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  label: { color: '#8B6914', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginTop: 14, marginBottom: 6 },
  hint: { color: '#555', fontSize: 11, marginBottom: 8 },
  teamName: {
    fontSize: 22, fontWeight: '900', letterSpacing: 1, padding: 0,
    borderBottomWidth: 1, borderBottomColor: '#3D2800', paddingBottom: 6,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#FFF' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 8, marginBottom: 6,
  },
  addRow: { marginTop: 6 },
  numInput: {
    width: 54, fontSize: 16, fontWeight: '900', textAlign: 'center',
    backgroundColor: '#1A0F00', borderRadius: 6, paddingVertical: 8,
  },
  nameInput: {
    flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600',
    backgroundColor: '#1A0F00', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10,
  },
  removeBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#555', fontSize: 15, fontWeight: '700' },
  addBtn: { width: 34, height: 34, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#0D0700', fontSize: 20, fontWeight: '900' },
  deleteRow: { alignItems: 'center', paddingVertical: 14, marginTop: 20 },
  deleteRowText: { color: '#C25E5E', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});
