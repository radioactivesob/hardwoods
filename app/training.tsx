import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKidStats } from '../hooks/useKidStats';
import { useTraining, TRAINING_IN_PROGRESS_KEY } from '../hooks/useTraining';
import {
  Drill, drillTotalAttempts, sessionLine, formatPct, SPOTS, ZONES,
} from '../hooks/trainingStats';
import { KidProfile, kidColor } from '../hooks/kidStats';
import { useAllOrientations } from '../hooks/useScreenOrientation';

const POSITION_LABEL: Record<string, string> = {
  any: 'ANY', guard: 'GUARD', wing: 'WING', post: 'POST',
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "5 spots · 50 shots", or "1 spot · 25 shots". */
function drillSummary(d: Drill) {
  const spots = new Set(d.steps.map(s => s.spotId)).size;
  const shots = drillTotalAttempts(d);
  return `${spots} spot${spots === 1 ? '' : 's'} · ${shots} shots${d.target ? ` · target ${Math.round(d.target * 100)}%` : ''}`;
}

export default function Training() {
  useAllOrientations();
  const router = useRouter();
  const { profiles, loading: kidsLoading } = useKidStats();
  const { allDrills, sessionsForKid, loading } = useTraining();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<{ kidId: string; drillId?: string; shots: number } | null>(null);

  // Most families track one kid — don't make them tap to open the only card.
  useEffect(() => {
    if (!selectedId && profiles.length === 1) setSelectedId(profiles[0].id);
  }, [profiles.length]);

  // A paused session shows on its kid's card as "resume".
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(TRAINING_IN_PROGRESS_KEY).then(raw => {
        if (!raw) return setLive(null);
        const s = JSON.parse(raw);
        setLive(s?.shots?.length > 0 ? { kidId: s.kidId, drillId: s.drillId, shots: s.shots.length } : null);
      });
    }, []),
  );

  const drills = allDrills();

  const start = (profile: KidProfile, drillId?: string) => {
    if (live && live.kidId !== profile.id) {
      const other = profiles.find(p => p.id === live.kidId);
      Alert.alert(
        'Session In Progress',
        `${other?.name ?? 'Another kid'} has a paused session with ${live.shots} shot${live.shots === 1 ? '' : 's'}. Starting a new one will discard it.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard & Start',
            style: 'destructive',
            onPress: () => {
              AsyncStorage.removeItem(TRAINING_IN_PROGRESS_KEY);
              setLive(null);
              router.push({ pathname: '/trainingrun', params: { kidId: profile.id, ...(drillId ? { drillId } : {}) } });
            },
          },
        ],
      );
      return;
    }
    router.push({ pathname: '/trainingrun', params: { kidId: profile.id, ...(drillId ? { drillId } : {}) } });
  };

  const summaryFor = (profile: KidProfile) => {
    const s = sessionsForKid(profile.id);
    if (s.length === 0) return 'No sessions yet';
    const shots = s.flatMap(x => x.shots);
    const l = sessionLine(shots);
    return `${s.length} session${s.length === 1 ? '' : 's'} · ${formatPct(l.pct)} overall`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.title}>TRAINING</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!kidsLoading && profiles.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No players yet</Text>
            <Text style={styles.emptyHint}>
              Training uses the same players as My Kid. Create one there first,
              then come back to run a drill.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/mykid')}>
              <Text style={styles.emptyBtnText}>GO TO MY KID</Text>
            </TouchableOpacity>
          </View>
        )}

        {profiles.map(profile => {
          const open = selectedId === profile.id;
          const accent = kidColor(profile);
          const recent = sessionsForKid(profile.id).slice(-3).reverse();
          const resumable = live?.kidId === profile.id;

          return (
            <View key={profile.id}>
              <TouchableOpacity
                style={[styles.kidCard, open && { borderColor: accent }]}
                onPress={() => setSelectedId(open ? null : profile.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.badge, { borderColor: accent }]}>
                  <Text style={[styles.badgeText, { color: accent }]}>
                    {profile.number ? `#${profile.number}` : profile.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.kidName}>{profile.name}</Text>
                    {resumable && (
                      <View style={styles.liveBadge}>
                        <Text style={styles.liveBadgeText}>● IN PROGRESS</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.kidMeta}>{loading ? '…' : summaryFor(profile)}</Text>
                </View>
                <Text style={[styles.chevron, { color: accent }]}>{open ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {open && (
                <View style={styles.detail}>
                  {resumable && (
                    <TouchableOpacity
                      style={[styles.resumeBtn, { borderColor: accent }]}
                      onPress={() => router.push({
                        pathname: '/trainingrun',
                        params: { kidId: profile.id, ...(live?.drillId ? { drillId: live.drillId } : {}) },
                      })}
                    >
                      <Text style={[styles.resumeText, { color: accent }]}>
                        ▶ RESUME — {live?.shots} SHOT{live?.shots === 1 ? '' : 'S'} IN
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.openGymBtn, { backgroundColor: accent }]}
                    onPress={() => start(profile)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.openGymText}>▶ OPEN GYM</Text>
                    <Text style={styles.openGymSub}>No drill — tap the court where she shot</Text>
                  </TouchableOpacity>

                  <Text style={styles.sectionLabel}>DRILLS</Text>
                  {drills.map(d => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.drillRow}
                      onPress={() => start(profile, d.id)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.drillName}>{d.name}</Text>
                          {d.position !== 'any' && (
                            <View style={styles.posTag}>
                              <Text style={styles.posTagText}>{POSITION_LABEL[d.position]}</Text>
                            </View>
                          )}
                          {d.source && (
                            <View style={[styles.posTag, styles.coachTag]}>
                              <Text style={[styles.posTagText, { color: '#7BC67B' }]}>COACH</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.drillMeta}>{drillSummary(d)}</Text>
                        {d.description ? (
                          <Text style={styles.drillDesc} numberOfLines={2}>{d.description}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.drillChevron}>›</Text>
                    </TouchableOpacity>
                  ))}

                  {recent.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
                      {recent.map(s => {
                        const l = sessionLine(s.shots);
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={styles.sessionRow}
                            onPress={() => router.push({ pathname: '/trainingresult', params: { sessionId: s.id } })}
                            activeOpacity={0.75}
                          >
                            <View style={[styles.sessionPct, { borderColor: accent }]}>
                              <Text style={[styles.sessionPctText, { color: accent }]}>{formatPct(l.pct)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.sessionTitle}>{s.drillName ?? 'Open gym'}</Text>
                              <Text style={styles.sessionMeta}>
                                {formatDate(s.date)} · {l.made}/{l.attempted} shots
                              </Text>
                            </View>
                            <Text style={styles.drillChevron}>›</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
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
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { color: '#C8A040', fontSize: 17, fontWeight: '800', marginBottom: 10 },
  emptyHint: { color: '#666', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: '#8B6914', borderRadius: 8, paddingHorizontal: 22, paddingVertical: 12 },
  emptyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  kidCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginBottom: 8,
  },
  badge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A0F00',
    borderWidth: 2, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 14, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  kidName: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  kidMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  liveBadge: { backgroundColor: '#1E3B1E', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  liveBadgeText: { color: '#4CAF50', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  chevron: { fontSize: 14 },
  detail: {
    backgroundColor: '#0D0700', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 14, marginTop: -4, marginBottom: 8,
  },
  resumeBtn: {
    borderWidth: 2, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginBottom: 10,
  },
  resumeText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  openGymBtn: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  openGymText: { color: '#1A0F00', fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  openGymSub: { color: '#1A0F00', fontSize: 10, marginTop: 3, opacity: 0.75 },
  sectionLabel: {
    color: '#8B6914', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 8, marginTop: 4,
  },
  drillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A0F00', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 12, marginBottom: 8,
  },
  drillName: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  drillMeta: { color: '#8B6914', fontSize: 11, marginTop: 3 },
  drillDesc: { color: '#5A4210', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  drillChevron: { color: '#8B6914', fontSize: 20, fontWeight: '300' },
  posTag: {
    borderWidth: 1, borderColor: '#3D2800', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  coachTag: { borderColor: '#2F5E2F' },
  posTagText: { color: '#8B6914', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A0F00', borderRadius: 8, borderWidth: 1, borderColor: '#2A1A00',
    padding: 10, marginBottom: 8,
  },
  sessionPct: {
    width: 52, height: 40, borderRadius: 6, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  sessionPctText: { fontSize: 14, fontWeight: '900' },
  sessionTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  sessionMeta: { color: '#666', fontSize: 11, marginTop: 2 },
});
