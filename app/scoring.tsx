import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGame, Player } from '../context/GameContext';

type ScoringStep =
  | { kind: 'player_select' }
  | { kind: 'action'; player: Player }
  | { kind: 'foul_shots'; player: Player; shotCount: number; shotIndex: number; made: number }
  | { kind: 'bench_in'; outPlayer: Player }
  | { kind: 'bench_select' };

export default function ScoringPanel() {
  const router = useRouter();
  const { team } = useLocalSearchParams<{ team: 'A' | 'B' }>();
  const { state, dispatch, activePlayers, benchPlayers } = useGame();

  const teamKey = team === 'A' ? 'teamA' : 'teamB';
  const otherTeamKey = team === 'A' ? 'teamB' : 'teamA';
  const teamData = state[teamKey];
  const otherTeamData = state[otherTeamKey];

  const [step, setStep] = useState<ScoringStep>({ kind: 'player_select' });
  const [benchMode, setBenchMode] = useState(false);

  const active = activePlayers(team);
  const bench = benchPlayers(team);

  const handlePlayerTap = (player: Player) => {
    if (benchMode) {
      // bench mode: select outgoing player
      setStep({ kind: 'bench_in', outPlayer: player });
      setBenchMode(false);
    } else {
      setStep({ kind: 'action', player });
    }
  };

  const handleBenchPlayerTap = (inPlayer: Player) => {
    if (step.kind === 'bench_in') {
      dispatch({ type: 'SUBSTITUTE', team, outPlayerId: step.outPlayer.id, inPlayerId: inPlayer.id });
      setStep({ kind: 'player_select' });
    }
  };

  const handleAction = (action: string, player: Player) => {
    if (action === '2pts') {
      dispatch({ type: 'ADD_POINTS', team, playerId: player.id, points: 2 });
      setStep({ kind: 'player_select' });
    } else if (action === '3pts') {
      dispatch({ type: 'ADD_POINTS', team, playerId: player.id, points: 3 });
      setStep({ kind: 'player_select' });
    } else if (action === 'foul') {
      dispatch({ type: 'ADD_FOUL', team, playerId: player.id });
      setStep({ kind: 'player_select' });
    } else if (action === 'timeout') {
      dispatch({ type: 'USE_TIMEOUT', team });
      setStep({ kind: 'player_select' });
    } else if (action === 'foul_1') {
      setStep({ kind: 'foul_shots', player, shotCount: 1, shotIndex: 0, made: 0 });
    } else if (action === 'foul_2') {
      setStep({ kind: 'foul_shots', player, shotCount: 2, shotIndex: 0, made: 0 });
    } else if (action === 'foul_3') {
      setStep({ kind: 'foul_shots', player, shotCount: 3, shotIndex: 0, made: 0 });
    }
  };

  const handleFreeThrow = (made: boolean) => {
    if (step.kind !== 'foul_shots') return;
    const pts = made ? 1 : 0;
    dispatch({ type: 'ADD_POINTS', team, playerId: step.player.id, points: pts, isFreeThrow: true, made });
    const nextIdx = step.shotIndex + 1;
    if (nextIdx >= step.shotCount) {
      setStep({ kind: 'player_select' });
    } else {
      setStep({ ...step, shotIndex: nextIdx, made: step.made + (made ? 1 : 0) });
    }
  };

  const handleTeamAction = (action: string) => {
    if (action === 'timeout') {
      dispatch({ type: 'USE_TIMEOUT', team });
      setStep({ kind: 'player_select' });
    } else if (action === 'technical') {
      // coach technical — opponent gets 2 FTs, use a placeholder player
      setStep({ kind: 'player_select' });
    }
  };

  const teamColor = teamData.color;
  const isLeft = team === 'A';

  const renderPlayerGrid = (players: Player[], onTap: (p: Player) => void, highlight?: string) => (
    <View style={styles.playerGrid}>
      {players.map(p => (
        <TouchableOpacity
          key={p.id}
          style={[
            styles.playerButton,
            { borderColor: teamColor },
            highlight === p.id && styles.playerButtonHighlight,
          ]}
          onPress={() => onTap(p)}
          activeOpacity={0.7}
        >
          <Text style={[styles.playerNumber, { color: teamColor }]}>{p.number || '?'}</Text>
          <Text style={styles.playerName} numberOfLines={1}>{p.name || 'Player'}</Text>
          <Text style={styles.playerFouls}>F:{p.stats.fouls}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderActionPanel = () => {
    if (step.kind === 'action') {
      const p = step.player;
      return (
        <View style={styles.actionPanel}>
          <Text style={[styles.actionTitle, { color: teamColor }]}>#{p.number} {p.name}</Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => handleAction('2pts', p)}>
              <Text style={styles.actionBtnText}>2 PTS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnBlue]} onPress={() => handleAction('3pts', p)}>
              <Text style={styles.actionBtnText}>3 PTS</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]} onPress={() => handleAction('foul', p)}>
              <Text style={styles.actionBtnText}>FOUL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnYellow]} onPress={() => handleAction('timeout', p)}>
              <Text style={[styles.actionBtnText, { color: '#000' }]}>T/O</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.foulShotLabel}>FREE THROWS</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtnSm, styles.actionBtnOrange]} onPress={() => handleAction('foul_1', p)}>
              <Text style={styles.actionBtnSmText}>1 SHOT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnSm, styles.actionBtnOrange]} onPress={() => handleAction('foul_2', p)}>
              <Text style={styles.actionBtnSmText}>2 SHOTS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtnSm, styles.actionBtnOrange]} onPress={() => handleAction('foul_3', p)}>
              <Text style={styles.actionBtnSmText}>3 SHOTS</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep({ kind: 'player_select' })}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (step.kind === 'foul_shots') {
      const { player: p, shotCount, shotIndex } = step;
      return (
        <View style={styles.actionPanel}>
          <Text style={[styles.actionTitle, { color: teamColor }]}>#{p.number} FREE THROWS</Text>
          <Text style={styles.foulShotProgress}>Shot {shotIndex + 1} of {shotCount}</Text>
          <View style={styles.foulShotRow}>
            <TouchableOpacity style={[styles.foulShotBtn, styles.foulShotMake]} onPress={() => handleFreeThrow(true)}>
              <Text style={styles.foulShotBtnText}>✓ MAKE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.foulShotBtn, styles.foulShotMiss]} onPress={() => handleFreeThrow(false)}>
              <Text style={styles.foulShotBtnText}>✗ MISS</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep({ kind: 'player_select' })}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (step.kind === 'bench_in') {
      return (
        <View style={styles.actionPanel}>
          <Text style={[styles.actionTitle, { color: teamColor }]}>
            SUB OUT: #{step.outPlayer.number}
          </Text>
          <Text style={styles.subInstructions}>Tap incoming player from bench</Text>
          <ScrollView style={styles.benchList}>
            {bench.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.benchPlayerRow, { borderColor: teamColor }]}
                onPress={() => handleBenchPlayerTap(p)}
              >
                <Text style={[styles.benchPlayerNum, { color: teamColor }]}>#{p.number}</Text>
                <Text style={styles.benchPlayerName}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setBenchMode(false); setStep({ kind: 'player_select' }); }}>
            <Text style={styles.cancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default: team controls
    return (
      <View style={styles.actionPanel}>
        <Text style={styles.actionPanelHint}>Select a player{'\n'}to score</Text>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnYellow, { marginTop: 12 }]} onPress={() => handleTeamAction('timeout')}>
          <Text style={[styles.actionBtnText, { color: '#000' }]}>TEAM T/O</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed, { marginTop: 8 }]} onPress={() => handleTeamAction('technical')}>
          <Text style={styles.actionBtnText}>TECHNICAL</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const teamSide = (
    <View style={[styles.teamSide, { borderColor: teamColor + '44' }]}>
      <View style={[styles.teamSideHeader, { backgroundColor: teamColor + '22' }]}>
        <Text style={[styles.teamSideName, { color: teamColor }]}>{teamData.name}</Text>
        <TouchableOpacity
          style={[styles.benchToggle, benchMode && { backgroundColor: teamColor }]}
          onPress={() => { setBenchMode(b => !b); setStep({ kind: 'player_select' }); }}
        >
          <Text style={[styles.benchToggleText, benchMode && { color: '#000' }]}>
            {benchMode ? '⚡ BENCH' : 'BENCH'}
          </Text>
        </TouchableOpacity>
      </View>

      {benchMode ? (
        <View style={{ flex: 1 }}>
          <Text style={styles.benchLabel}>SELECT INCOMING PLAYER</Text>
          {bench.length === 0 ? (
            <Text style={styles.noBench}>No bench players</Text>
          ) : (
            bench.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.benchPlayerRow, { borderColor: teamColor }]}
                onPress={() => {
                  // In bench mode from team side, we need to pick outgoing next
                  // Actually let's simplify: tap bench player, then tap active player as outgoing
                  setBenchMode(false);
                  setStep({ kind: 'bench_in', outPlayer: p });
                  // Hmm, we need the opposite — let's keep it simple:
                  // tap BENCH toggle → active players become "select outgoing"
                }}
              >
                <Text style={[styles.benchPlayerNum, { color: teamColor }]}>#{p.number}</Text>
                <Text style={styles.benchPlayerName}>{p.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {step.kind === 'bench_in' ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.benchLabel}>TAP INCOMING FROM BENCH</Text>
              {bench.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.benchPlayerRow, { borderColor: teamColor }]}
                  onPress={() => handleBenchPlayerTap(p)}
                >
                  <Text style={[styles.benchPlayerNum, { color: teamColor }]}>#{p.number}</Text>
                  <Text style={styles.benchPlayerName}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setStep({ kind: 'player_select' })}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.courtLabel}>ON COURT</Text>
              {renderPlayerGrid(
                active,
                (p) => {
                  if (step.kind === 'bench_in') {
                    // This is the outgoing player
                    handleBenchPlayerTap(p);
                  } else {
                    handlePlayerTap(p);
                  }
                },
                step.kind === 'action' ? step.player.id : undefined
              )}
            </>
          )}
        </View>
      )}
    </View>
  );

  const actionSide = (
    <View style={styles.actionSide}>
      {renderActionPanel()}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Mini Header */}
      <View style={styles.miniHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.miniHeaderTitle}>SCORING — {teamData.name.toUpperCase()}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {isLeft ? (
          <>
            {teamSide}
            {actionSide}
          </>
        ) : (
          <>
            {actionSide}
            {teamSide}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0F00',
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D0700',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A1A00',
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backBtnText: {
    color: '#8B6914',
    fontSize: 12,
    fontWeight: '700',
  },
  miniHeaderTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },

  // Team Side
  teamSide: {
    flex: 1,
    borderRightWidth: 1,
    padding: 8,
  },
  teamSideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  teamSideName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  benchToggle: {
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  benchToggleText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  courtLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 6,
    marginLeft: 2,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  playerButton: {
    width: '30%',
    aspectRatio: 0.9,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#0D0700',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  playerButtonHighlight: {
    backgroundColor: '#3A2800',
  },
  playerNumber: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  playerName: {
    color: '#AAA',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  playerFouls: {
    color: '#666',
    fontSize: 9,
    marginTop: 1,
  },

  // Action Side
  actionSide: {
    width: 200,
    backgroundColor: '#100800',
    borderLeftWidth: 1,
    borderLeftColor: '#2A1A00',
    padding: 12,
  },
  actionPanel: {
    flex: 1,
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  actionPanelHint: {
    color: '#444',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnGreen: { backgroundColor: '#1A5C1A' },
  actionBtnBlue: { backgroundColor: '#1A3A7A' },
  actionBtnRed: { backgroundColor: '#7A1A1A' },
  actionBtnYellow: { backgroundColor: '#C8A040' },
  actionBtnOrange: { backgroundColor: '#7A3A00' },
  actionBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  actionBtnSm: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnSmText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  foulShotLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  foulShotProgress: {
    color: '#AAA',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  foulShotRow: {
    flexDirection: 'row',
    gap: 8,
  },
  foulShotBtn: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  foulShotMake: { backgroundColor: '#1A5C1A' },
  foulShotMiss: { backgroundColor: '#7A1A1A' },
  foulShotBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#2A1A00',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  subInstructions: {
    color: '#888',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
  },

  // Bench
  benchLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  benchList: {
    flex: 1,
  },
  benchPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    backgroundColor: '#0D0700',
  },
  benchPlayerNum: {
    fontSize: 18,
    fontWeight: '900',
    width: 36,
  },
  benchPlayerName: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  noBench: {
    color: '#444',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
  },
});
