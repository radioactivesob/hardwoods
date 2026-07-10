import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useGame } from '../context/GameContext';
import { useLandscapeOnly } from '../hooks/useScreenOrientation';

const { width, height } = Dimensions.get('window');

export default function Scoreboard() {
  useLandscapeOnly();
  const router = useRouter();
  const { state, dispatch, undo, canUndo, totalScore } = useGame();
  const { teamA, teamB, currentPeriod, teamAFouls, teamBFouls, teamATimeoutsLeft, teamBTimeoutsLeft, rules } = state;

  const scoreA = totalScore('A');
  const scoreB = totalScore('B');

  const periodLabel = currentPeriod > rules.numPeriods ? 'OT' : `Q${currentPeriod}`;
  const nextPeriodLabel = currentPeriod >= rules.numPeriods ? 'OT' : `Q${currentPeriod + 1}`;

  const confirmNextPeriod = () => {
    Alert.alert(
      `Advance to ${nextPeriodLabel}?`,
      `End ${periodLabel} and start ${nextPeriodLabel}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Start ${nextPeriodLabel}`, style: 'destructive', onPress: () => dispatch({ type: 'NEXT_PERIOD' }) },
      ]
    );
  };

  const confirmPrevPeriod = () => {
    if (currentPeriod <= 1) return;
    const prevLabel = currentPeriod - 1 > rules.numPeriods ? 'OT' : `Q${currentPeriod - 1}`;
    Alert.alert(
      `Go back to ${prevLabel}?`,
      'This will undo the period advance. Scores already entered will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Back to ${prevLabel}`, onPress: () => dispatch({ type: 'PREV_PERIOD' }) },
      ]
    );
  };

  const confirmNewGame = () => {
    Alert.alert(
      'Start New Game?',
      'This will reset all scores and stats. Export the scorebook first if you want to save it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New Game', style: 'destructive', onPress: () => dispatch({ type: 'RESET_GAME' }) },
      ]
    );
  };

  const renderTimeoutDots = (left: number, total: number) => {
    const dots = [];
    for (let i = 0; i < total; i++) {
      dots.push(
        <View key={i} style={[styles.timeoutDot, i < left ? styles.timeoutDotFilled : styles.timeoutDotEmpty]} />
      );
    }
    return <View style={styles.timeoutDots}>{dots}</View>;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Strip */}
      <View style={styles.header}>
        <View style={styles.headerTeam}>
          <Text style={[styles.headerTeamName, { color: teamA.color }]} numberOfLines={1}>{teamA.name}</Text>
          <View style={styles.headerStats}>
            <Text style={styles.headerLabel}>FOULS: <Text style={styles.headerValue}>{teamAFouls}</Text></Text>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerLabel}>TO:</Text>
            {renderTimeoutDots(teamATimeoutsLeft, rules.timeoutsPerGame)}
          </View>
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerScore}>
            <Text style={{ color: teamA.color }}>{scoreA}</Text>
            <Text style={styles.headerScoreDash}> – </Text>
            <Text style={{ color: teamB.color }}>{scoreB}</Text>
          </Text>
          <Text style={styles.headerPeriod}>{periodLabel}</Text>
        </View>

        <View style={[styles.headerTeam, styles.headerTeamRight]}>
          <Text style={[styles.headerTeamName, { color: teamB.color }]} numberOfLines={1}>{teamB.name}</Text>
          <View style={styles.headerStats}>
            {renderTimeoutDots(teamBTimeoutsLeft, rules.timeoutsPerGame)}
            <Text style={styles.headerLabel}>TO</Text>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerLabel}>FOULS: <Text style={styles.headerValue}>{teamBFouls}</Text></Text>
          </View>
        </View>
      </View>

      {/* Team Buttons */}
      <View style={styles.teamButtons}>
        <TouchableOpacity
          style={[styles.teamButton, { backgroundColor: teamA.color + '22', borderColor: teamA.color }]}
          onPress={() => router.push({ pathname: '/scoring', params: { team: 'A' } })}
          activeOpacity={0.7}
        >
          <Text style={[styles.teamButtonName, { color: teamA.color }]}>{teamA.name}</Text>
          <Text style={[styles.teamButtonScore, { color: teamA.color }]}>{scoreA}</Text>
          <Text style={[styles.teamButtonHint, { color: teamA.color + 'AA' }]}>TAP TO SCORE</Text>
        </TouchableOpacity>

        <View style={styles.teamButtonDivider}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <TouchableOpacity
          style={[styles.teamButton, { backgroundColor: teamB.color + '22', borderColor: teamB.color }]}
          onPress={() => router.push({ pathname: '/scoring', params: { team: 'B' } })}
          activeOpacity={0.7}
        >
          <Text style={[styles.teamButtonName, { color: teamB.color }]}>{teamB.name}</Text>
          <Text style={[styles.teamButtonScore, { color: teamB.color }]}>{scoreB}</Text>
          <Text style={[styles.teamButtonHint, { color: teamB.color + 'AA' }]}>TAP TO SCORE</Text>
        </TouchableOpacity>
      </View>

      {/* Admin Bar */}
      <View style={styles.adminBar}>
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/rules')}>
          <Text style={styles.adminButtonText}>⚙ RULES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/teams')}>
          <Text style={styles.adminButtonText}>👥 TEAMS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/scorebook')}>
          <Text style={styles.adminButtonText}>📋 SCOREBOOK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/mykid')}>
          <Text style={styles.adminButtonText}>⭐ MY KID</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.adminButton, !canUndo && styles.adminButtonDisabled]}
          onPress={canUndo ? undo : undefined}
        >
          <Text style={[styles.adminButtonText, { color: canUndo ? '#C8A040' : '#444' }]}>⟵ UNDO</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.adminButton, styles.adminButtonDanger]} onPress={confirmNewGame}>
          <Text style={[styles.adminButtonText, { color: '#FF6B6B' }]}>↺ NEW GAME</Text>
        </TouchableOpacity>

        <View style={styles.periodButtons}>
          {currentPeriod > 1 && (
            <TouchableOpacity style={styles.prevPeriodButton} onPress={confirmPrevPeriod}>
              <Text style={styles.prevPeriodText}>← {currentPeriod - 1 > rules.numPeriods ? 'OT' : `Q${currentPeriod - 1}`}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextPeriodButton} onPress={confirmNextPeriod}>
            <Text style={styles.nextPeriodText}>{nextPeriodLabel} →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0F00',
  },

  // Header
  header: {
    flexDirection: 'row',
    backgroundColor: '#0D0700',
    borderBottomWidth: 2,
    borderBottomColor: '#8B6914',
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    minHeight: 52,
  },
  headerTeam: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTeamRight: {
    alignItems: 'flex-end',
  },
  headerTeamName: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headerValue: {
    color: '#FFF',
    fontWeight: '800',
  },
  headerSpacer: {
    width: 8,
  },
  headerCenter: {
    alignItems: 'center',
    paddingHorizontal: 16,
    minWidth: 120,
  },
  headerScore: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerScoreDash: {
    color: '#555',
  },
  headerPeriod: {
    color: '#C8A040',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 2,
    textShadowColor: '#C8A04066',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  timeoutDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  timeoutDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginHorizontal: 1.5,
  },
  timeoutDotFilled: {
    backgroundColor: '#F0C040',
  },
  timeoutDotEmpty: {
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: '#555',
  },

  // Team Buttons
  teamButtons: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 0,
  },
  teamButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    marginHorizontal: 4,
    // Wood grain texture via shadow
    shadowColor: '#8B6914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  teamButtonDivider: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    color: '#444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  teamButtonName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  teamButtonScore: {
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  teamButtonHint: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 4,
  },

  // Admin Bar
  adminBar: {
    flexDirection: 'row',
    backgroundColor: '#0D0700',
    borderTopWidth: 2,
    borderTopColor: '#2A1A00',
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 6,
  },
  adminButton: {
    flex: 1,
    backgroundColor: '#2A1A00',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3D2800',
  },
  adminButtonDisabled: {
    opacity: 0.4,
  },
  adminButtonDanger: {
    borderColor: '#5A1A1A',
  },
  adminButtonText: {
    color: '#C8A040',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  adminButtonTextDisabled: {
    color: '#666',
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  prevPeriodButton: {
    backgroundColor: '#2A1A00',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3D2800',
  },
  prevPeriodText: {
    color: '#8B6914',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nextPeriodButton: {
    backgroundColor: '#8B6914',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  nextPeriodText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
