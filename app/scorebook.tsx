import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGame } from '../context/GameContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function Scorebook() {
  const router = useRouter();
  const { state, totalScore } = useGame();
  const { teamA, teamB, periodScores, currentPeriod, rules } = state;
  const [exporting, setExporting] = useState(false);

  const scoreA = totalScore('A');
  const scoreB = totalScore('B');

  const generateHTML = () => {
    const periodHeaders = periodScores.map((_, i) =>
      `<th>Q${i + 1}</th>`
    ).join('');
    const totalHeader = '<th>TOT</th>';

    const teamRows = (team: typeof teamA, teamKey: 'teamA' | 'teamB') => {
      return team.players
        .filter(p => p.name || p.number)
        .map(p => {
          const s = p.stats;
          const fgPct = s.fgAttempted > 0 ? Math.round((s.fgMade / s.fgAttempted) * 100) : 0;
          const ftPct = s.ftAttempted > 0 ? Math.round((s.ftMade / s.ftAttempted) * 100) : 0;
          return `
            <tr>
              <td>${p.number}</td>
              <td>${p.name}</td>
              <td>${s.fgMade}/${s.fgAttempted}</td>
              <td>${s.threeMade}/${s.threeAttempted}</td>
              <td>${s.ftMade}/${s.ftAttempted}</td>
              <td>${s.fouls}</td>
              <td><strong>${s.points}</strong></td>
            </tr>
          `;
        }).join('');
    };

    const teamTotals = (team: typeof teamA) => {
      const players = team.players;
      const fgM = players.reduce((a, p) => a + p.stats.fgMade, 0);
      const fgA = players.reduce((a, p) => a + p.stats.fgAttempted, 0);
      const thM = players.reduce((a, p) => a + p.stats.threeMade, 0);
      const thA = players.reduce((a, p) => a + p.stats.threeAttempted, 0);
      const ftM = players.reduce((a, p) => a + p.stats.ftMade, 0);
      const ftA = players.reduce((a, p) => a + p.stats.ftAttempted, 0);
      const fouls = players.reduce((a, p) => a + p.stats.fouls, 0);
      const pts = players.reduce((a, p) => a + p.stats.points, 0);
      return { fgM, fgA, thM, thA, ftM, ftA, fouls, pts };
    };

    const totA = teamTotals(teamA);
    const totB = teamTotals(teamB);

    const scoreRows = periodScores.map((s, i) =>
      `<tr><td>Q${i + 1}</td><td>${s.teamA}</td><td>${s.teamB}</td></tr>`
    ).join('');

    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hardwoods Scorebook</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; background: #fff; padding: 24px; }
    h1 { font-size: 28px; text-align: center; color: #1A0F00; letter-spacing: 3px; margin-bottom: 4px; }
    .subtitle { text-align: center; color: #888; font-size: 12px; letter-spacing: 2px; margin-bottom: 20px; }
    .score-banner { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 16px; background: #1A0F00; border-radius: 8px; margin-bottom: 20px; }
    .team-final { text-align: center; }
    .team-name-final { color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 1px; }
    .team-score-final { color: #C8A040; font-size: 40px; font-weight: 900; line-height: 1; }
    .vs { color: #555; font-size: 20px; font-weight: 700; }
    .periods-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .periods-table th, .periods-table td { border: 1px solid #ddd; padding: 6px 10px; text-align: center; font-size: 12px; }
    .periods-table th { background: #1A0F00; color: #C8A040; letter-spacing: 1px; }
    .periods-table tr:nth-child(even) { background: #f9f9f9; }
    .section-title { font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #1A0F00; border-bottom: 2px solid #1A0F00; padding-bottom: 4px; margin-bottom: 8px; margin-top: 16px; }
    .box-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    .box-table th { background: #2A1A00; color: #C8A040; padding: 5px 8px; text-align: center; letter-spacing: 1px; font-size: 10px; }
    .box-table td { border: 1px solid #eee; padding: 4px 8px; text-align: center; }
    .box-table .name-col { text-align: left; }
    .box-table tr:nth-child(even) { background: #f9f9f9; }
    .totals-row td { background: #f0e8cc; font-weight: 700; border-top: 2px solid #1A0F00; }
    .team-a-color { color: ${teamA.color}; }
    .team-b-color { color: ${teamB.color}; }
  </style>
</head>
<body>
  <h1>HARDWOODS</h1>
  <div class="subtitle">OFFICIAL SCOREBOOK — ${date}</div>

  <div class="score-banner">
    <div class="team-final">
      <div class="team-name-final" style="color:${teamA.color}">${teamA.name}</div>
      <div class="team-score-final" style="color:${teamA.color}">${scoreA}</div>
    </div>
    <div class="vs">VS</div>
    <div class="team-final">
      <div class="team-name-final" style="color:${teamB.color}">${teamB.name}</div>
      <div class="team-score-final" style="color:${teamB.color}">${scoreB}</div>
    </div>
  </div>

  <div class="section-title">PERIOD SCORES</div>
  <table class="periods-table">
    <tr>
      <th>PERIOD</th>
      <th class="team-a-color">${teamA.name}</th>
      <th class="team-b-color">${teamB.name}</th>
    </tr>
    ${scoreRows}
    <tr>
      <td><strong>TOTAL</strong></td>
      <td><strong>${scoreA}</strong></td>
      <td><strong>${scoreB}</strong></td>
    </tr>
  </table>

  <div class="section-title" style="color:${teamA.color}">${teamA.name.toUpperCase()} — BOX SCORE</div>
  <table class="box-table">
    <tr>
      <th>#</th><th class="name-col">NAME</th><th>FG</th><th>3PT</th><th>FT</th><th>PF</th><th>PTS</th>
    </tr>
    ${teamRows(teamA, 'teamA')}
    <tr class="totals-row">
      <td colspan="2">TEAM TOTALS</td>
      <td>${totA.fgM}/${totA.fgA}</td>
      <td>${totA.thM}/${totA.thA}</td>
      <td>${totA.ftM}/${totA.ftA}</td>
      <td>${totA.fouls}</td>
      <td><strong>${totA.pts}</strong></td>
    </tr>
  </table>

  <div class="section-title" style="color:${teamB.color}">${teamB.name.toUpperCase()} — BOX SCORE</div>
  <table class="box-table">
    <tr>
      <th>#</th><th class="name-col">NAME</th><th>FG</th><th>3PT</th><th>FT</th><th>PF</th><th>PTS</th>
    </tr>
    ${teamRows(teamB, 'teamB')}
    <tr class="totals-row">
      <td colspan="2">TEAM TOTALS</td>
      <td>${totB.fgM}/${totB.fgA}</td>
      <td>${totB.thM}/${totB.thA}</td>
      <td>${totB.ftM}/${totB.ftA}</td>
      <td>${totB.fouls}</td>
      <td><strong>${totB.pts}</strong></td>
    </tr>
  </table>

  <div style="text-align:center;color:#ccc;font-size:10px;margin-top:24px">Generated by Hardwoods Scorebook App</div>
</body>
</html>
    `;
  };

  const exportPDF = async () => {
    try {
      setExporting(true);
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save Scorebook PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Export Failed', String(e));
    } finally {
      setExporting(false);
    }
  };

  const renderPlayerRow = (p: typeof teamA.players[0]) => {
    const s = p.stats;
    return (
      <View key={p.id} style={styles.tableRow}>
        <Text style={[styles.cell, styles.cellNum]}>{p.number}</Text>
        <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.cell}>{s.fgMade}/{s.fgAttempted}</Text>
        <Text style={styles.cell}>{s.threeMade}/{s.threeAttempted}</Text>
        <Text style={styles.cell}>{s.ftMade}/{s.ftAttempted}</Text>
        <Text style={styles.cell}>{s.fouls}</Text>
        <Text style={[styles.cell, styles.cellPts]}>{s.points}</Text>
      </View>
    );
  };

  const teamTotalsRow = (team: typeof teamA) => {
    const players = team.players;
    const fgM = players.reduce((a, p) => a + p.stats.fgMade, 0);
    const fgA = players.reduce((a, p) => a + p.stats.fgAttempted, 0);
    const thM = players.reduce((a, p) => a + p.stats.threeMade, 0);
    const thA = players.reduce((a, p) => a + p.stats.threeAttempted, 0);
    const ftM = players.reduce((a, p) => a + p.stats.ftMade, 0);
    const ftA = players.reduce((a, p) => a + p.stats.ftAttempted, 0);
    const fouls = players.reduce((a, p) => a + p.stats.fouls, 0);
    const pts = players.reduce((a, p) => a + p.stats.points, 0);
    return (
      <View style={[styles.tableRow, styles.totalsRow]}>
        <Text style={[styles.cell, styles.cellNum]}></Text>
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
        <TouchableOpacity
          style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
          onPress={exportPDF}
          disabled={exporting}
        >
          <Text style={styles.exportBtnText}>{exporting ? 'EXPORTING...' : '↓ PDF'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>
        {/* Final Score */}
        <View style={styles.scoreBanner}>
          <View style={styles.finalTeam}>
            <Text style={[styles.finalTeamName, { color: teamA.color }]}>{teamA.name}</Text>
            <Text style={[styles.finalScore, { color: teamA.color }]}>{totalScore('A')}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.finalTeam}>
            <Text style={[styles.finalTeamName, { color: teamB.color }]}>{teamB.name}</Text>
            <Text style={[styles.finalScore, { color: teamB.color }]}>{totalScore('B')}</Text>
          </View>
        </View>

        {/* Period Scores */}
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
            { label: teamA.name, key: 'teamA' as const, color: teamA.color, total: totalScore('A') },
            { label: teamB.name, key: 'teamB' as const, color: teamB.color, total: totalScore('B') },
          ].map(row => (
            <View key={row.key} style={styles.periodRow}>
              <Text style={[styles.periodCell, { color: row.color, fontWeight: '700' }]} numberOfLines={1}>
                {row.label}
              </Text>
              {periodScores.map((s, i) => (
                <Text key={i} style={styles.periodCell}>{s[row.key]}</Text>
              ))}
              <Text style={[styles.periodCell, { color: row.color, fontWeight: '900' }]}>{row.total}</Text>
            </View>
          ))}
        </View>

        {/* Box Score - Team A */}
        <Text style={[styles.sectionLabel, { color: teamA.color }]}>{teamA.name.toUpperCase()} — BOX SCORE</Text>
        <View style={styles.boxTable}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.cellNum, styles.headerCell]}>#</Text>
            <Text style={[styles.cell, styles.cellName, styles.headerCell]}>PLAYER</Text>
            <Text style={[styles.cell, styles.headerCell]}>FG</Text>
            <Text style={[styles.cell, styles.headerCell]}>3PT</Text>
            <Text style={[styles.cell, styles.headerCell]}>FT</Text>
            <Text style={[styles.cell, styles.headerCell]}>PF</Text>
            <Text style={[styles.cell, styles.headerCell, styles.cellPts]}>PTS</Text>
          </View>
          {teamA.players.filter(p => p.name || p.number).map(renderPlayerRow)}
          {teamTotalsRow(teamA)}
        </View>

        {/* Box Score - Team B */}
        <Text style={[styles.sectionLabel, { color: teamB.color }]}>{teamB.name.toUpperCase()} — BOX SCORE</Text>
        <View style={styles.boxTable}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.cell, styles.cellNum, styles.headerCell]}>#</Text>
            <Text style={[styles.cell, styles.cellName, styles.headerCell]}>PLAYER</Text>
            <Text style={[styles.cell, styles.headerCell]}>FG</Text>
            <Text style={[styles.cell, styles.headerCell]}>3PT</Text>
            <Text style={[styles.cell, styles.headerCell]}>FT</Text>
            <Text style={[styles.cell, styles.headerCell]}>PF</Text>
            <Text style={[styles.cell, styles.headerCell, styles.cellPts]}>PTS</Text>
          </View>
          {teamB.players.filter(p => p.name || p.number).map(renderPlayerRow)}
          {teamTotalsRow(teamB)}
        </View>

        <View style={{ height: 40 }} />
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
  exportBtn: {
    backgroundColor: '#8B6914',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
    padding: 12,
  },
  scoreBanner: {
    flexDirection: 'row',
    backgroundColor: '#0D0700',
    borderRadius: 10,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A1A00',
  },
  finalTeam: {
    alignItems: 'center',
    flex: 1,
  },
  finalTeamName: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  finalScore: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 52,
  },
  vsText: {
    color: '#444',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLabel: {
    color: '#8B6914',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 8,
  },
  periodTable: {
    backgroundColor: '#0D0700',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A1A00',
  },
  periodHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#2A1A00',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  periodRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A0F00',
  },
  periodCell: {
    flex: 1,
    color: '#CCC',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  periodHeaderCell: {
    color: '#8B6914',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  boxTable: {
    backgroundColor: '#0D0700',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A1A00',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A0F00',
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#2A1A00',
    borderTopWidth: 0,
  },
  totalsRow: {
    backgroundColor: '#1A1000',
    borderTopWidth: 2,
    borderTopColor: '#8B6914',
  },
  cell: {
    flex: 1,
    color: '#CCC',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  headerCell: {
    color: '#8B6914',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cellNum: {
    maxWidth: 30,
    flex: 0.4,
  },
  cellName: {
    flex: 2.5,
    textAlign: 'left',
    paddingLeft: 4,
  },
  cellPts: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 13,
  },
});
