import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { StatBar } from '../../components/StatBar';
import { PixelPanel } from '../../components/PixelPanel';
import { colors } from '../../theme/colors';

interface HabitSummary {
  id: string;
  title: string;
  currentStreak: number;
  todayCompleted: boolean | null;
  xpReward: number;
}

interface DashboardData {
  todayHabits: HabitSummary[];
  sleepAvg7d: number;
  monthBalance: number;
}

export function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [refreshing,setRefreshing]= useState(false);

  const fetchData = useCallback(async () => {
    try {
      const r = await api.get<DashboardData>('/dashboard');
      setData(r.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleHabitLog = async (habitId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.post(`/habits/${habitId}/log`, { status: 'completed' });
      await fetchData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { /* ignore */ }
  };

  if (!user) return null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accentGold} />}
    >
      {/* Hero card */}
      <PixelPanel style={styles.heroCard}>
        <Text style={styles.heroName}>{user.displayName}</Text>
        <Text style={styles.level}>NIVEL {user.level}</Text>
        <View style={{ marginTop: 12 }}>
          <StatBar label="HP" value={user.hp}  max={user.maxHp}         color={colors.accentPink} />
          <StatBar label="XP" value={user.xp}  max={user.xpToNextLevel} color={colors.accentGold} />
        </View>
        <View style={styles.statsRow}>
          {[['STR', user.strength], ['INT', user.intelligence], ['CHA', user.charisma]].map(([k, v]) => (
            <View key={k as string} style={styles.statChip}>
              <Text style={styles.statKey}>{k}</Text>
              <Text style={styles.statVal}>{v}</Text>
            </View>
          ))}
        </View>
      </PixelPanel>

      {/* Today's habits */}
      {data && data.todayHabits.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HÁBITOS DE HOY</Text>
          {data.todayHabits.map((h) => (
            <PixelPanel key={h.id} style={styles.habitRow} accent={h.todayCompleted ? colors.accentGreen : colors.accentGold}>
              <View style={styles.habitInner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitTitle}>{h.title}</Text>
                  <Text style={styles.habitStreak}>🔥 {h.currentStreak} días</Text>
                </View>
                {!h.todayCompleted && (
                  <TouchableOpacity
                    style={styles.completeBtn}
                    onPress={() => handleHabitLog(h.id)}
                  >
                    <Text style={styles.completeBtnText}>+{h.xpReward}XP</Text>
                  </TouchableOpacity>
                )}
                {h.todayCompleted && (
                  <Text style={styles.doneText}>✓</Text>
                )}
              </View>
            </PixelPanel>
          ))}
        </View>
      )}

      {/* Quick stats */}
      {data && (
        <View style={styles.statsGrid}>
          <PixelPanel style={styles.statCard} accent={colors.accentCyan}>
            <Text style={styles.statCardLabel}>SUEÑO PROM.</Text>
            <Text style={styles.statCardVal}>{data.sleepAvg7d.toFixed(1)}h</Text>
          </PixelPanel>
          <PixelPanel style={styles.statCard} accent={colors.accentGreen}>
            <Text style={styles.statCardLabel}>BALANCE MES</Text>
            <Text style={[styles.statCardVal, { fontSize: 14 }]}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(data.monthBalance)}
            </Text>
          </PixelPanel>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.bgDeep },
  content:       { padding: 16, gap: 12 },
  heroCard:      { marginBottom: 4 },
  heroName:      { fontFamily: 'monospace', fontSize: 13, color: colors.textPrimary, textAlign: 'center' },
  level:         { fontFamily: 'monospace', fontSize: 10, color: colors.accentGold, textAlign: 'center', marginTop: 4 },
  statsRow:      { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12, gap: 8 },
  statChip:      { alignItems: 'center', backgroundColor: colors.bgDeep, borderWidth: 2, borderColor: colors.borderPixel, paddingHorizontal: 12, paddingVertical: 4 },
  statKey:       { fontFamily: 'monospace', fontSize: 8, color: colors.textSecondary },
  statVal:       { fontFamily: 'monospace', fontSize: 14, color: colors.textPrimary },
  section:       { gap: 8 },
  sectionTitle:  { fontFamily: 'monospace', fontSize: 9, color: colors.accentGold, marginBottom: 2 },
  habitRow:      { marginBottom: 0 },
  habitInner:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitTitle:    { fontFamily: 'monospace', fontSize: 10, color: colors.textPrimary },
  habitStreak:   { fontFamily: 'monospace', fontSize: 10, color: colors.accentRed, marginTop: 2 },
  completeBtn:   { backgroundColor: colors.accentGold, borderWidth: 2, borderColor: colors.borderPixel, paddingHorizontal: 10, paddingVertical: 6 },
  completeBtnText:{ fontFamily: 'monospace', fontSize: 8, color: colors.borderPixel, fontWeight: 'bold' },
  doneText:      { fontFamily: 'monospace', fontSize: 18, color: colors.accentGreen },
  statsGrid:     { flexDirection: 'row', gap: 8 },
  statCard:      { flex: 1, alignItems: 'center' },
  statCardLabel: { fontFamily: 'monospace', fontSize: 7, color: colors.textSecondary, marginBottom: 4 },
  statCardVal:   { fontFamily: 'monospace', fontSize: 18, color: colors.textPrimary },
});
