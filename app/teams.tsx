import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGame, TeamConfig, Player } from '../context/GameContext';
import { useTeamLibrary, savedToTeamConfig, SavedTeam } from '../hooks/useTeamLibrary';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const COLORS = [
  '#1E90FF', '#FF4500', '#32CD32', '#FF1493',
  '#FFD700', '#9400D3', '#FF6600', '#00CED1',
  '#FF0000', '#00FF7F', '#FF69B4', '#FFFFFF',
];

let playerIdCounter = 1000;
const newPlayer = (teamPrefix: string): Player => {
  playerIdCounter++;
  return {
    id: `${teamPrefix}-custom-${playerIdCounter}`,
    name: '', number: '', isStarting: false, isActive: false,
    stats: { points: 0, fgMade: 0, fgAttempted: 0, threeMade: 0, threeAttempted: 0, ftMade: 0, ftAttempted: 0, fouls: 0 },
  };
};

export default function TeamSetup() {
  useAllOrientations();
  const router = useRouter();
  const { state, dispatch } = useGame();
  const { library, saveTeam, deleteTeam } = useTeamLibrary();
  const [activeTeam, setActiveTeam] = useState<'A' | 'B'>('A');
  const [teamA, setTeamA] = useState<TeamConfig>({ ...state.teamA, players: state.teamA.players.map(p => ({ ...p, stats: { ...p.stats } })) });
  const [teamB, setTeamB] = useState<TeamConfig>({ ...state.teamB, players: state.teamB.players.map(p => ({ ...p, stats: { ...p.stats } })) });
  const [showLibrary, setShowLibrary] = useState(false);

  const team = activeTeam === 'A' ? teamA : teamB;
  const setTeam = activeTeam === 'A' ? setTeamA : setTeamB;

  const save = () => {
    const starters = teamA.players.filter(p => p.isStarting).length;
    const startersB = teamB.players.filter(p => p.isStarting).length;
    if (starters < 5 || startersB < 5) {
      Alert.alert('Needs 5 Starters', 'Each team must have exactly 5 starting players designated.');
      return;
    }
    const finalA = { ...teamA, players: teamA.players.map(p => ({ ...p, isActive: p.isStarting })) };
    const finalB = { ...teamB, players: teamB.players.map(p => ({ ...p, isActive: p.isStarting })) };
    dispatch({ type: 'SET_TEAM', team: 'A', config: finalA });
    dispatch({ type: 'SET_TEAM', team: 'B', config: finalB });
    router.back();
  };

  const handleSaveToLibrary = () => {
    if (!team.name.trim()) {
      Alert.alert('Name Required', 'Give the team a name before saving.');
      return;
    }
    const existing = library.find(t => t.name.toLowerCase() === team.name.toLowerCase());
    if (existing) {
      Alert.alert('Update Team?', `"${team.name}" is already saved. Replace it with the current roster?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', onPress: () => saveTeam(team).then(() => Alert.alert('Saved', `"${team.name}" updated in library.`)) },
      ]);
    } else {
      saveTeam(team).then(() => Alert.alert('Saved', `"${team.name}" saved to library.`));
    }
  };

  const handleLoadFromLibrary = (saved: SavedTeam) => {
    const loaded = savedToTeamConfig(saved, activeTeam);
    setTeam(loaded);
    setShowLibrary(false);
  };

  const handleDeleteFromLibrary = (saved: SavedTeam) => {
    Alert.alert('Delete Team?', `Remove "${saved.name}" from the library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTeam(saved.id) },
    ]);
  };

  const updatePlayer = (id: string, field: keyof Player, value: any) => {
    setTeam(prev => ({
      ...prev,
      players: prev.players.map(p => p.id === id ? { ...p, [field]: value } : p),
    }));
  };

  const toggleStarter = (id: string) => {
    const starterCount = team.players.filter(p => p.isStarting && p.id !== id).length;
    const player = team.players.find(p => p.id === id)!;
    if (!player.isStarting && starterCount >= 5) {
      Alert.alert('5 Starters Max', 'Deselect another starter first.');
      return;
    }
    updatePlayer(id, 'isStarting', !player.isStarting);
  };

  const addPlayer = () => {
    if (team.players.length >= 15) return;
    setTeam(prev => ({ ...prev, players: [...prev.players, newPlayer(activeTeam)] }));
  };

  const removePlayer = (id: string) => {
    if (team.players.length <= 5) return;
    setTeam(prev => ({ ...prev, players: prev.players.filter(p => p.id !== id) }));
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>TEAM SETUP</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>SAVE</Text>
        </TouchableOpacity>
      </View>

      {/* Team Tabs */}
      <View style={styles.teamTabs}>
        {(['A', 'B'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.teamTab, activeTeam === t && { borderBottomColor: (t === 'A' ? teamA : teamB).color }]}
            onPress={() => setActiveTeam(t)}
          >
            <Text style={[styles.teamTabText, activeTeam === t && { color: (t === 'A' ? teamA : teamB).color }]}>
              {(t === 'A' ? teamA : teamB).name || `Team ${t}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Library Buttons */}
        <View style={styles.libraryRow}>
          <TouchableOpacity style={styles.libraryBtn} onPress={() => setShowLibrary(true)}>
            <Text style={styles.libraryBtnText}>📋 LOAD FROM LIBRARY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.libraryBtn, styles.libraryBtnSave]} onPress={handleSaveToLibrary}>
            <Text style={[styles.libraryBtnText, { color: '#C8A040' }]}>💾 SAVE TO LIBRARY</Text>
          </TouchableOpacity>
        </View>

        {/* Team Info */}
        <Text style={styles.sectionLabel}>TEAM INFO</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Team Name</Text>
          <TextInput
            style={[styles.textInput, { borderColor: team.color + '66', flex: 1 }]}
            value={team.name}
            onChangeText={v => setTeam(prev => ({ ...prev, name: v }))}
            placeholder="Team Name"
            placeholderTextColor="#444"
          />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Head Coach</Text>
          <TextInput
            style={[styles.textInput, { borderColor: team.color + '66', flex: 1 }]}
            value={team.coachName}
            onChangeText={v => setTeam(prev => ({ ...prev, coachName: v }))}
            placeholder="Coach Name"
            placeholderTextColor="#444"
          />
        </View>

        {/* Color Picker */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Team Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={styles.colorRow}>
              {COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, team.color === c && styles.colorSwatchActive]}
                  onPress={() => setTeam(prev => ({ ...prev, color: c }))}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.divider} />

        {/* Roster */}
        <View style={styles.rosterHeader}>
          <Text style={styles.sectionLabel}>ROSTER ({team.players.length}/15)</Text>
          <Text style={styles.starterCount}>Starters: {team.players.filter(p => p.isStarting).length}/5</Text>
        </View>
        <Text style={styles.rosterHint}>★ = Starter (need exactly 5)</Text>

        {team.players.map((p, idx) => (
          <View key={p.id} style={[styles.playerRow, { borderLeftColor: team.color }]}>
            <Text style={styles.playerIdx}>{idx + 1}</Text>
            <TextInput
              style={styles.numInput}
              value={p.number}
              onChangeText={v => updatePlayer(p.id, 'number', v)}
              placeholder="#"
              placeholderTextColor="#444"
              keyboardType="numeric"
              maxLength={3}
            />
            <TextInput
              style={styles.nameInput}
              value={p.name}
              onChangeText={v => updatePlayer(p.id, 'name', v)}
              placeholder="Player Name"
              placeholderTextColor="#444"
            />
            <TouchableOpacity
              style={[styles.starterBtn, p.isStarting && { backgroundColor: team.color }]}
              onPress={() => toggleStarter(p.id)}
            >
              <Text style={[styles.starterBtnText, p.isStarting && { color: '#000' }]}>★</Text>
            </TouchableOpacity>
            {team.players.length > 5 && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePlayer(p.id)}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {team.players.length < 15 && (
          <TouchableOpacity style={styles.addPlayerBtn} onPress={addPlayer}>
            <Text style={[styles.addPlayerText, { color: team.color }]}>+ ADD PLAYER</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Team Library Modal */}
      <Modal
        visible={showLibrary}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLibrary(false)}
        supportedOrientations={['landscape-left', 'landscape-right']}
      >
        <View style={libStyles.overlay}>
          <View style={libStyles.modal}>
            <View style={libStyles.modalHeader}>
              <Text style={libStyles.modalTitle}>TEAM LIBRARY</Text>
              <TouchableOpacity onPress={() => setShowLibrary(false)}>
                <Text style={libStyles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={libStyles.modalSubtitle}>Loading into: {team.name || `Team ${activeTeam}`}</Text>

            {library.length === 0 ? (
              <View style={libStyles.emptyState}>
                <Text style={libStyles.emptyText}>No saved teams yet.</Text>
                <Text style={libStyles.emptyHint}>Set up a roster and tap "Save to Library" to store it here.</Text>
              </View>
            ) : (
              <ScrollView style={libStyles.list}>
                {library.map(saved => (
                  <View key={saved.id} style={libStyles.teamRow}>
                    <View style={[libStyles.colorDot, { backgroundColor: saved.color }]} />
                    <View style={libStyles.teamInfo}>
                      <Text style={libStyles.teamName}>{saved.name}</Text>
                      <Text style={libStyles.teamMeta}>
                        {saved.players.length} players · {saved.players.filter(p => p.isStarting).length} starters · saved {formatDate(saved.savedAt)}
                      </Text>
                      <Text style={libStyles.teamRoster} numberOfLines={1}>
                        {saved.players.filter(p => p.isStarting).map(p => `#${p.number} ${p.name}`).join(', ')}
                      </Text>
                    </View>
                    <View style={libStyles.teamActions}>
                      <TouchableOpacity style={libStyles.loadBtn} onPress={() => handleLoadFromLibrary(saved)}>
                        <Text style={libStyles.loadBtnText}>LOAD</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={libStyles.deleteBtn} onPress={() => handleDeleteFromLibrary(saved)}>
                        <Text style={libStyles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A0F00' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0D0700', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: '#8B6914',
  },
  backText: { color: '#8B6914', fontSize: 13, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  saveBtn: { backgroundColor: '#8B6914', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  saveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  teamTabs: { flexDirection: 'row', backgroundColor: '#0D0700', borderBottomWidth: 1, borderBottomColor: '#2A1A00' },
  teamTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  teamTabText: { color: '#555', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  libraryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  libraryBtn: {
    flex: 1, backgroundColor: '#0D0700', borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A1A00',
  },
  libraryBtnSave: { borderColor: '#3D2800' },
  libraryBtnText: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sectionLabel: { color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10, marginTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  infoLabel: { color: '#888', fontSize: 12, fontWeight: '600', width: 80 },
  textInput: {
    backgroundColor: '#0D0700', color: '#FFF', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: '600',
  },
  colorRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  colorSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: '#FFF', transform: [{ scale: 1.2 }] },
  divider: { height: 1, backgroundColor: '#2A1A00', marginVertical: 16 },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  starterCount: { color: '#888', fontSize: 11, fontWeight: '600' },
  rosterHint: { color: '#555', fontSize: 10, marginBottom: 10, fontStyle: 'italic' },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0700',
    borderRadius: 6, borderLeftWidth: 3, marginBottom: 6, paddingHorizontal: 8, paddingVertical: 6, gap: 6,
  },
  playerIdx: { color: '#555', fontSize: 11, width: 16, textAlign: 'center' },
  numInput: {
    backgroundColor: '#1A0F00', color: '#FFF', borderWidth: 1, borderColor: '#2A1A00',
    borderRadius: 4, width: 44, paddingHorizontal: 6, paddingVertical: 6,
    fontSize: 14, fontWeight: '800', textAlign: 'center',
  },
  nameInput: {
    backgroundColor: '#1A0F00', color: '#FFF', borderWidth: 1, borderColor: '#2A1A00',
    borderRadius: 4, flex: 1, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, fontWeight: '600',
  },
  starterBtn: {
    width: 32, height: 32, borderRadius: 4, backgroundColor: '#1A0F00',
    borderWidth: 1, borderColor: '#3D2800', justifyContent: 'center', alignItems: 'center',
  },
  starterBtnText: { color: '#555', fontSize: 16 },
  removeBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  removeBtnText: { color: '#7A1A1A', fontSize: 14, fontWeight: '700' },
  addPlayerBtn: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A1A00',
    borderRadius: 6, paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  addPlayerText: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
});

const libStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: '#1A0F00', borderRadius: 12, borderWidth: 1, borderColor: '#8B6914',
    width: '85%', maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#2A1A00',
  },
  modalTitle: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  closeBtn: { color: '#666', fontSize: 18, fontWeight: '700', paddingHorizontal: 4 },
  modalSubtitle: { color: '#555', fontSize: 11, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list: { padding: 12 },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyText: { color: '#555', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: '#444', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  teamRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0700',
    borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#2A1A00', gap: 10,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7, flexShrink: 0 },
  teamInfo: { flex: 1 },
  teamName: { color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  teamMeta: { color: '#666', fontSize: 10, marginBottom: 2 },
  teamRoster: { color: '#555', fontSize: 10, fontStyle: 'italic' },
  teamActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  loadBtn: {
    backgroundColor: '#8B6914', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  loadBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: '#7A1A1A', fontSize: 14, fontWeight: '700' },
});
