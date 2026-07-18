import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal,
} from 'react-native';

const ALL_ORIENTATIONS = ['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right'] as const;

interface Props {
  visible: boolean;
  accent: string;
  initial?: { us: number; them: number };
  // null = user chose to proceed without a score (skip)
  onSubmit: (score: { us: number; them: number } | null) => void;
  skipLabel?: string; // omit to hide the skip path (backfill mode uses cancel instead)
  onCancel?: () => void;
}

// Optional final-score entry. Kept deliberately tiny: two number
// fields, one tap to skip — the minimal-setup principle applies to
// endings too.
export default function ScorePrompt({ visible, accent, initial, onSubmit, skipLabel, onCancel }: Props) {
  const [us, setUs] = useState('');
  const [them, setThem] = useState('');

  useEffect(() => {
    if (visible) {
      setUs(initial ? String(initial.us) : '');
      setThem(initial ? String(initial.them) : '');
    }
  }, [visible, initial]);

  const canSave = us.trim() !== '' && them.trim() !== '';

  const save = () => {
    if (!canSave) return;
    onSubmit({ us: parseInt(us, 10) || 0, them: parseInt(them, 10) || 0 });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel ?? (() => onSubmit(null))}
      supportedOrientations={[...ALL_ORIENTATIONS]}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { borderColor: accent }]}>
          <Text style={styles.title}>FINAL TEAM SCORE</Text>
          <Text style={styles.hint}>Optional — adds game context to stats and share cards.</Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={[styles.scoreLabel, { color: accent }]}>US</Text>
              <TextInput
                style={[styles.scoreInput, { borderColor: accent }]}
                value={us}
                onChangeText={setUs}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor="#444"
                autoFocus
              />
            </View>
            <Text style={styles.dash}>—</Text>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>THEM</Text>
              <TextInput
                style={styles.scoreInput}
                value={them}
                onChangeText={setThem}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor="#444"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: canSave ? '#8B6914' : '#2A1A00' }]}
            onPress={save}
            disabled={!canSave}
          >
            <Text style={[styles.saveBtnText, !canSave && { color: '#555' }]}>SAVE SCORE</Text>
          </TouchableOpacity>

          {skipLabel ? (
            <TouchableOpacity style={styles.skipBtn} onPress={() => onSubmit(null)}>
              <Text style={styles.skipBtnText}>{skipLabel}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.skipBtn} onPress={onCancel}>
              <Text style={styles.skipBtnText}>CANCEL</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: '#1A0F00', borderRadius: 12, borderWidth: 1,
    width: 300, padding: 20, alignItems: 'center',
  },
  title: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  hint: { color: '#666', fontSize: 11, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  scoreCol: { alignItems: 'center', gap: 6 },
  scoreLabel: { color: '#8B6914', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  scoreInput: {
    backgroundColor: '#0D0700', color: '#FFF', borderWidth: 1, borderColor: '#3D2800',
    borderRadius: 8, width: 76, paddingVertical: 10, fontSize: 24, fontWeight: '900',
    textAlign: 'center',
  },
  dash: { color: '#555', fontSize: 20, fontWeight: '700', marginTop: 18 },
  saveBtn: { borderRadius: 8, paddingVertical: 12, alignItems: 'center', alignSelf: 'stretch' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  skipBtn: { paddingVertical: 12, marginTop: 4 },
  skipBtnText: { color: '#666', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
