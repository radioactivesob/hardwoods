import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGame, Player, PlayerStats } from '../context/GameContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

type EditTarget = { player: Player; team: 'A' | 'B' } | null;

export default function Scorebook() {
  const router = useRouter();
  const { state, dispatch, totalScore } = useGame();
  const { teamA, teamB, periodScores } = state;
  const [exporting, setExporting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editStats, setEditStats] = useState<PlayerStats | null>(null);

  const scoreA = totalScore('A');
  const scoreB = totalScore('B');

  const openEdit = (player: Player, team: 'A' | 'B') => {
    setEditTarget({ player, team });
    setEditStats({ ...player.stats });
  };

  const saveEdit = () => {
    if (!editTarget || !editStats) return;
    dispatch({ type: 'EDIT_PLAYER_STATS', team: editTarget.team, playerId: editTarget.player.id, stats: editStats });
    setEditTarget(null);
    setEditStats(null);
  };

  const statStepper = (label: string, field: keyof PlayerStats, min = 0) => {
    if (!editStats) return null;
    const val = editStats[field] as number;
    return (
      <View key={field} style={editStyles.statRow}>
        <Text style={editStyles.statLabel}>{label}</Text>
        <View style={editStyles.stepperRow}>
          <TouchableOpacity
            style={editStyles.stepBtn}
            onPress={() => setEditStats(s => s ? { ...s, [field]: Math.max(min, (s[field] as number) - 1) } : s)}
          >
            <Text style={editStyles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={editStyles.statVal}>{val}</Text>
          <TouchableOpacity
            style={editStyles.stepBtn}
            onPress={() => setEditStats(s => s ? { ...s, [field]: (s[field] as number) + 1 } : s)}
          >
            <Text style={editStyles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const generateHTML = () => {
    const teamRows = (team: typeof teamA) => team.players
      .filter(p => p.name || p.number)
      .map(p => {
        const s = p.stats;
        return `<tr>
          <td>${p.number}</td><td>${p.name}</td>
          <td>${s.fgMade}/${s.fgAttempted}</td>
          <td>${s.threeMade}/${s.threeAttempted}</td>
          <td>${s.ftMade}/${s.ftAttempted}</td>
          <td>${s.fouls}</td>
          <td><strong>${s.points}</strong></td>
        </tr>`;
      }).join('');

    const teamTotals = (team: typeof teamA) => {
      const pl = team.players;
      return {
        fgM: pl.reduce((a, p) => a + p.stats.fgMade, 0),
        fgA: pl.reduce((a, p) => a + p.stats.fgAttempted, 0),
        thM: pl.reduce((a, p) => a + p.stats.threeMade, 0),
        thA: pl.reduce((a, p) => a + p.stats.threeAttempted, 0),
        ftM: pl.reduce((a, p) => a + p.stats.ftMade, 0),
        ftA: pl.reduce((a, p) => a + p.stats.ftAttempted, 0),
        fouls: pl.reduce((a, p) => a + p.stats.fouls, 0),
        pts: pl.reduce((a, p) => a + p.stats.points, 0),
      };
    };

    const totA = teamTotals(teamA);
    const totB = teamTotals(teamB);
    const scoreRows = periodScores.map((s, i) => `<tr><td>Q${i + 1}</td><td>${s.teamA}</td><td>${s.teamB}</td></tr>`).join('');
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hardwoods Scorebook</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#111;background:#fff;padding:24px}
      h1{font-size:28px;text-align:center;color:#1A0F00;letter-spacing:3px;margin-bottom:4px}
      .sub{text-align:center;color:#888;font-size:12px;letter-spacing:2px;margin-bottom:20px}
      .banner{display:flex;justify-content:center;align-items:center;gap:20px;padding:16px;background:#1A0F00;border-radius:8px;margin-bottom:20px}
      .tn{color:#fff;font-size:14px;font-weight:700;letter-spacing:1px;text-align:center}
      .ts{font-size:40px;font-weight:900;line-height:1;text-align:center}
      .vs{color:#555;font-size:20px;font-weight:700}
      .pt{width:100%;border-collapse:collapse;margin-bottom:20px}
      .pt th,.pt td{border:1px solid #ddd;padding:6px 10px;text-align:center;font-size:12px}
      .pt th{background:#1A0F00;color:#C8A040}
      .sec{font-size:13px;font-weight:700;letter-spacing:2px;color:#1A0F00;border-bottom:2px solid #1A0F00;padding-bottom:4px;margin:16px 0 8px}
      .bt{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px}
      .bt th{background:#2A1A00;color:#C8A040;padding:5px 8px;text-align:center;font-size:10px}
      .bt td{border:1px solid #eee;padding:4px 8px;text-align:center}
      .bt tr:nth-child(even){background:#f9f9f9}
      .tot td{background:#f0e8cc;font-weight:700;border-top:2px solid #1A0F00}
    </style></head><body>
    <h1>HARDWOODS</h1><div class="sub">OFFICIAL SCOREBOOK — ${date}</div>
    <div class="banner">
      <div><div class="tn" style="color:${teamA.color}">${teamA.name}</div><div class="ts" style="color:${teamA.color}">${scoreA}</div></div>
      <div class="vs">VS</div>
      <div><div class="tn" style="color:${teamB.color}">${teamB.name}</div><div class="ts" style="color:${teamB.color}">${scoreB}</div></div>
    </div>
    <div class="sec">PERIOD SCORES</div>
    <table class="pt"><tr><th>PERIOD</th><th style="color:${teamA.color}">${teamA.name}</th><th style="color:${teamB.color}">${teamB.name}</th></tr>
    ${scoreRows}<tr><td><strong>TOTAL</strong></td><td><strong>${scoreA}</strong></td><td><strong>${scoreB}</strong></td></tr></table>
    <div class="sec" style="color:${teamA.color}">${teamA.name.toUpperCase()} — BOX SCORE</div>
    <table class="bt"><tr><th>#</th><th>NAME</th><th>FG</th><th>3PT</th><th>FT</th><th>PF</th><th>PTS</th></tr>
    ${teamRows(teamA)}<tr class="tot"><td colspan="2">TEAM TOTALS</td><td>${totA.fgM}/${totA.fgA}</td><td>${totA.thM}/${totA.thA}</td><td>${totA.ftM}/${totA.ftA}</td><td>${totA.fouls}</td><td><strong>${totA.pts}</strong></td></tr></table>
    <div class="sec" style="color:${teamB.color}">${teamB.name.toUpperCase()} — BOX SCORE</div>
    <table class="bt"><tr><th>#</th><th>NAME</th><th>FG</th><th>3PT</th><th>FT</th><th>PF</th><th>PTS</th></tr>
    ${teamRows(teamB)}<tr class="tot"><td colspan="2">TEAM TOTALS</td><td>${totB.fgM}/${totB.fgA}</td><td>${totB.thM}/${totB.thA}</td><td>${totB.ftM}/${totB.ftA}</td><td>${totB.fouls}</td><td><strong>${totB.pts}</strong></td></tr></table>
    <div style="text-align:center;color:#ccc;font-size:10px;margin-top:24px">Generated by Hardwoods Scorebook App</div>
    </body></html>`;
  };

  const exportPDF = async () => {
    try {
      setExporting(true);
      const { uri } = await Print.printToFileAsync({ html: generateHTML(), base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Scorebook PDF', UTI: 'com.adobe.pdf' });
    } catch (e) {
      Alert.alert('Export Failed', String(e));
    } finally {
      setExporting(false);
    }
  };

  const renderPlayerRow = (p: Player, team: 'A' | 'B') => {
    const s = p.stats;
    return (
      <TouchableOpacity
        key={p.id}
        style={[styles.tableRow, editMode && styles.tableRowEditable]}
        onPress={() => editMode && openEdit(p, team)}
        activeOpacity={editMode ? 0.6 : 1}
      >
        <Text style={[styles.cell, styles.cellNum]}>{p.number}</Text>
        <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.cell}>{s.fgMade}/{s.fgAttempted}</Text>
        <Text style={styles.cell}>{s.threeMade}/{s.threeAttempted}</Text>
        <Text style={styles.cell}>{s.ftMade}/{s.ftAttempted}</Text>
        <Text style={styles.cell}>{s.fouls}</Text>
        <Text style={[styles.cell, styles.cellPts]}>{s.points}</Text>
        {editMode && <Text style={styles.editIndicator}>✎</Text>}
      </TouchableOpacity>
    );
  };

  const teamTotalsRow = (team: typeof teamA) => {
    const pl = team.players;
    const fgM = pl.reduce((a, p) => a + p.stats.fgMade, 0);
    const fgA = pl.reduce((a, p) => a + p.stats.fgAttempted, 0);
    const thM = pl.reduce((a, p) => a + p.stats.threeMade, 0);
    const thA = pl.reduce((a, p) => a + p.stats.threeAttempted, 0);
    const ftM = pl.reduce((a, p) => a + p.stats.ftMade, 0);
    const ftA = pl.reduce((a, p) => a + p.stats.ftAttempted, 0);
    const fouls = pl.reduce((a, p) => a + p.stats.fouls, 0);
    const pts = pl.reduce((a, p) => a + p.stats.points, 0);
    return (
      <View style={[styles.tableRow, styles.totalsRow]}>
        <Text style={[styles.cell, styles.cellNum]} />
        <Text style={[styles.cell, styles.cellName, { color: '#C8A040' }]}>TOTALS</Text>
        <Text style={styles.cell}>{fgM}/{fgA}</Text>
        <Text style={styles.cell}>{thM}/{thA}</Text>
        <Text style={styles.cell}>{ftM}/{ftA}</Text>
        <Text style={styles.cell}>{fouls}</Text>
        <Text style={[styles.cell, styles.cellPts, { color: '#C8A040' }]}>{pts}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>SCOREBOOK</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.editBtn, editMode && styles.editBtnActive]}
            onPress={() => setEditMode(e => !e)}
          >
            <Text style={[styles.editBtnText, editMode && styles.editBtnTextActive]}>
              {editMode ? '✎ EDITING' : '✎ EDIT'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={exportPDF}
            disabled={exporting}
          >
            <Text style={styles.exportBtnText}>{exporting ? '...' : '↓ PDF'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {editMode && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>✎ Tap any player row to edit their stats</Text>
        </View>
      )}

      <ScrollView style={styles.scroll}>
        <View style={styles.scoreBanner}>
          <View style={styles.finalTeam}>
            <Text style={[styles.finalTeamName, { color: teamA.color }]}>{teamA.name}</Text>
            <Text style={[styles.finalScore, { color: teamA.color }]}>{scoreA}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.finalTeam}>
            <Text style={[styles.finalTeamName, { color: teamB.color }]}>{teamB.name}</Text>
            <Text style={[styles.finalScore, { color: teamB.color }]}>{scoreB}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PERIOD SCORES</Text>
        <View style={styles.periodTable}>
          <View style={styles.periodHeaderRow}>
            <Text style={[styles.periodCell, styles.periodHeaderCell]}>PERIOD</Text>
            {periodScores.map((_, i) => (
              <Text key={i} style={[styles.periodCell, styles.periodHeaderCell]}>Q{i + 1}</Text>
            ))}
            <Text style={[styles.periodCell, styles.periodHeaderCell]}>TOT</Text>
          </View>
          {[
            { label: teamA.name, key: 'teamA' as const, color: teamA.color, total: scoreA },
            { label: teamB.name, key: 'teamB' as const, color: teamB.color, total: scoreB },
          ].map(row => (
            <View key={row.key} style={styles.periodRow}>
              <Text style={[styles.periodCell, { color: row.color, fontWeight: '700' }]} numberOfLines={1}>{row.label}</Text>
              {periodScores.map((s, i) => (
                <Text key={i} style={styles.periodCell}>{s[row.key]}</Text>
              ))}
              <Text style={[styles.periodCell, { color: row.color, fontWeight: '900' }]}>{row.total}</Text>
            </View>
          ))}
        </View>

        {([
          { team: teamA, key: 'A' as const, color: teamA.color },
          { team: teamB, key: 'B' as const, color: teamB.color },
        ]).map(({ team, key, color }) => (
          <View key={key}>
            <Text style={[styles.sectionLabel, { color }]}>{team.name.toUpperCase()} — BOX SCORE</Text>
            <View style={styles.boxTable}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.cell, styles.cellNum, styles.headerCell]}>#</Text>
                <Text style={[styles.cell, styles.cellName, styles.headerCell]}>PLAYER</Text>
                <Text style={[styles.cell, styles.headerCell]}>FG</Text>
                <Text style={[styles.cell, styles.headerCell]}>3PT</Text>
                <Text style={[styles.cell, styles.headerCell]}>FT</Text>
                <Text style={[styles.cell, styles.headerCell]}>PF</Text>
                <Text style={[styles.cell, styles.headerCell, styles.cellPts]}>PTS</Text>
                {editMode && <Text style={[styles.cell, styles.headerCell, { flex: 0.4 }]} />}
              </View>
              {team.players.filter(p => p.name || p.number).map(p => renderPlayerRow(p, key))}
              {teamTotalsRow(team)}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)} supportedOrientations={['landscape-left', 'landscape-right']}>
        <View style={editStyles.overlay}>
          <View style={editStyles.modal}>
            <Text style={editStyles.modalTitle}>
              EDIT — #{editTarget?.player.number} {editTarget?.player.name}
            </Text>
            <Text style={editStyles.modalSubtitle}>Adjust stats individually</Text>
            <ScrollView style={editStyles.statList}>
              {statStepper('Points', 'points')}
              {statStepper('FG Made', 'fgMade')}
              {statStepper('FG Attempted', 'fgAttempted')}
              {statStepper('3PT Made', 'threeMade')}
              {statStepper('3PT Attempted', 'threeAttempted')}
              {statStepper('FT Made', 'ftMade')}
              {statStepper('FT Attempted', 'ftAttempted')}
              {statStepper('Personal Fouls', 'fouls')}
            </ScrollView>
            <View style={editStyles.modalButtons}>
              <TouchableOpacity style={editStyles.cancelBtn} onPress={() => setEditTarget(null)}>
                <Text style={editStyles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={editStyles.saveBtn} onPress={saveEdit}>
                <Text style={editStyles.saveBtnText}>SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  headerButtons: { flexDirection: 'row', gap: 8 },
  editBtn: {
    backgroundColor: '#2A1A00', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 6, borderWidth: 1, borderColor: '#3D2800',
  },
  editBtnActive: { backgroundColor: '#3A2A00', borderColor: '#C8A040' },
  editBtnText: { color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  editBtnTextActive: { color: '#C8A040' },
  exportBtn: {
    backgroundColor: '#8B6914', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  editBanner: {
    backgroundColor: '#3A2800', paddingVertical: 6, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#8B6914',
  },
  editBannerText: { color: '#C8A040', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  scroll: { flex: 1, padding: 12 },
  scoreBanner: {
    flexDirection: 'row', backgroundColor: '#0D0700', borderRadius: 10, padding: 16,
    justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 16,
    borderWidth: 1, borderColor: '#2A1A00',
  },
  finalTeam: { alignItems: 'center', flex: 1 },
  finalTeamName: { fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  finalScore: { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  vsText: { color: '#444', fontSize: 16, fontWeight: '700' },
  sectionLabel: { color: '#8B6914', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 6, marginTop: 8 },
  periodTable: { backgroundColor: '#0D0700', borderRadius: 8, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#2A1A00' },
  periodHeaderRow: { flexDirection: 'row', backgroundColor: '#2A1A00', paddingVertical: 6, paddingHorizontal: 8 },
  periodRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#1A0F00' },
  periodCell: { flex: 1, color: '#CCC', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  periodHeaderCell: { color: '#8B6914', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  boxTable: { backgroundColor: '#0D0700', borderRadius: 8, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#2A1A00' },
  tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#1A0F00', alignItems: 'center' },
  tableRowEditable: { backgroundColor: '#130C00' },
  tableHeader: { backgroundColor: '#2A1A00', borderTopWidth: 0 },
  totalsRow: { backgroundColor: '#1A1000', borderTopWidth: 2, borderTopColor: '#8B6914' },
  cell: { flex: 1, color: '#CCC', fontSize: 11, textAlign: 'center', fontWeight: '600' },
  headerCell: { color: '#8B6914', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  cellNum: { maxWidth: 30, flex: 0.4 },
  cellName: { flex: 2.5, textAlign: 'left', paddingLeft: 4 },
  cellPts: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  editIndicator: { color: '#8B6914', fontSize: 11, flex: 0.4, textAlign: 'center' },
});

const editStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: '#1A0F00', borderRadius: 12, borderWidth: 1, borderColor: '#8B6914',
    width: 320, maxHeight: '80%', padding: 20,
  },
  modalTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  modalSubtitle: { color: '#555', fontSize: 11, textAlign: 'center', marginBottom: 16, marginTop: 2 },
  statList: { maxHeight: 300 },
  statRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2A1A00',
  },
  statLabel: { color: '#CCC', fontSize: 13, fontWeight: '600', flex: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 32, height: 32, backgroundColor: '#2A1A00', borderRadius: 6,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3D2800',
  },
  stepBtnText: { color: '#C8A040', fontSize: 18, fontWeight: '700', lineHeight: 22 },
  statVal: { color: '#FFF', fontSize: 16, fontWeight: '800', width: 40, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, backgroundColor: '#2A1A00', borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#3D2800',
  },
  cancelBtnText: { color: '#666', fontSize: 13, fontWeight: '700' },
  saveBtn: { flex: 1, backgroundColor: '#8B6914', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
