import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api } from '../../services/api';
import { PixelPanel } from '../../components/PixelPanel';
import { colors } from '../../theme/colors';
import type { Quest } from '@noutlife/shared';

const DIFF_COLORS: Record<string, string> = {
  EASY:   colors.accentGreen,
  NORMAL: colors.accentBlue,
  HARD:   colors.accentRed,
  EPIC:   colors.accentPurple,
};

export function QuestsScreen() {
  const [quests, setQuests] = useState<Quest[]>([]);

  useEffect(() => {
    api.get<{ quests: Quest[] }>('/quests').then((r) => setQuests(r.data.quests)).catch(() => null);
  }, []);

  const completeQuest = async (id: string) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await api.patch(`/quests/${id}/complete`);
      setQuests((qs) => qs.filter((q) => q.id !== id));
    } catch {
      Alert.alert('Error', 'No se pudo completar la misión');
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.header}>MISIONES ACTIVAS</Text>

      {quests.length === 0 && (
        <PixelPanel>
          <Text style={styles.empty}>No hay misiones activas. ¡Crea una nueva!</Text>
        </PixelPanel>
      )}

      {quests.map((q) => (
        <PixelPanel key={q.id} accent={DIFF_COLORS[q.difficulty] ?? colors.accentGold}>
          <View style={styles.questHeader}>
            <View style={[styles.diffBadge, { borderColor: DIFF_COLORS[q.difficulty] ?? colors.accentGold }]}>
              <Text style={[styles.diffText, { color: DIFF_COLORS[q.difficulty] ?? colors.accentGold }]}>{q.difficulty}</Text>
            </View>
            <Text style={styles.category}>{q.category}</Text>
          </View>

          <Text style={styles.questTitle}>{q.title}</Text>
          {q.description && <Text style={styles.questDesc}>{q.description}</Text>}

          <View style={styles.rewardRow}>
            <Text style={styles.reward}>+{q.xpReward} XP</Text>
            <Text style={styles.reward}>+{q.goldReward} 💰</Text>
            {q.deadline && (
              <Text style={styles.deadline}>
                Vence: {new Date(q.deadline).toLocaleDateString('es-CO')}
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.completeBtn} onPress={() => completeQuest(q.id)}>
            <Text style={styles.completeBtnText}>COMPLETAR MISIÓN</Text>
          </TouchableOpacity>
        </PixelPanel>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.bgDeep },
  content:       { padding: 16, gap: 12 },
  header:        { fontFamily: 'monospace', fontSize: 11, color: colors.accentGold, marginBottom: 4 },
  empty:         { fontFamily: 'monospace', fontSize: 10, color: colors.textSecondary, textAlign: 'center' },
  questHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  diffBadge:     { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  diffText:      { fontFamily: 'monospace', fontSize: 8 },
  category:      { fontFamily: 'monospace', fontSize: 8, color: colors.textSecondary },
  questTitle:    { fontFamily: 'monospace', fontSize: 11, color: colors.textPrimary, marginBottom: 4 },
  questDesc:     { fontFamily: 'monospace', fontSize: 10, color: colors.textSecondary, marginBottom: 8 },
  rewardRow:     { flexDirection: 'row', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
  reward:        { fontFamily: 'monospace', fontSize: 10, color: colors.accentGold },
  deadline:      { fontFamily: 'monospace', fontSize: 9, color: colors.accentRed },
  completeBtn:   { backgroundColor: colors.accentGold, borderWidth: 2, borderColor: colors.borderPixel, padding: 10, alignItems: 'center' },
  completeBtnText:{ fontFamily: 'monospace', fontSize: 9, color: colors.borderPixel, fontWeight: 'bold' },
});
