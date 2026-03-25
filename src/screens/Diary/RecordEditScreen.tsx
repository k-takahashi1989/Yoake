import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { subHours } from 'date-fns';
import { DiaryStackParamList, SleepLog, SleepInputForm, SleepOnset, WakeFeeling } from '../../types';
import { getSleepLog, getGoal } from '../../services/firebase';
import { safeToDate } from '../../utils/dateUtils';
import { useSleepStore } from '../../stores/sleepStore';
import TimePickerRow from '../../components/common/TimePickerRow';
import HabitCheckRow from '../../components/diary/HabitCheckRow';

type Props = NativeStackScreenProps<DiaryStackParamList, 'RecordEdit'>;

export default function RecordEditScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const { saveLog, deleteLog } = useSleepStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [originalLog, setOriginalLog] = useState<SleepLog | null>(null);

  const defaultBedTime = subHours(new Date(), 8);
  defaultBedTime.setMinutes(0, 0, 0);

  const [form, setForm] = useState<SleepInputForm>({
    bedTime: defaultBedTime,
    wakeTime: new Date(),
    sleepOnset: 'NORMAL',
    wakeFeeling: 'NORMAL',
    habits: [],
    memo: '',
  });

  useEffect(() => {
    (async () => {
      const log = await getSleepLog(date);
      if (log) {
        setOriginalLog(log);
        setForm({
          bedTime: safeToDate(log.bedTime),
          wakeTime: safeToDate(log.wakeTime),
          sleepOnset: log.sleepOnset,
          wakeFeeling: log.wakeFeeling,
          habits: log.habits,
          memo: log.memo ?? '',
          deepSleepMinutes: log.deepSleepMinutes,
          remMinutes: log.remMinutes,
          lightSleepMinutes: log.lightSleepMinutes,
          awakenings: log.awakenings,
          heartRateAvg: log.heartRateAvg,
        });
      }
      setIsLoading(false);
    })();
  }, [date]);

  const handleDelete = () => {
    Alert.alert('記録を削除', 'この睡眠記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLog(date);
            navigation.pop(2);
          } catch {
            Alert.alert('削除失敗', '記録の削除に失敗しました。');
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    const resolvedWakeTime = (() => {
      if (form.wakeTime <= form.bedTime) {
        const next = new Date(form.wakeTime);
        next.setDate(next.getDate() + 1);
        return next;
      }
      return form.wakeTime;
    })();
    const correctedForm = { ...form, wakeTime: resolvedWakeTime };
    setIsSaving(true);
    try {
      const goal = await getGoal();
      await saveLog(
        correctedForm,
        goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null },
        originalLog?.source ?? 'MANUAL',
      );
      navigation.goBack();
    } catch {
      Alert.alert('保存失敗', '記録の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHabit = (id: string) => {
    setForm(prev => ({
      ...prev,
      habits: prev.habits.map(h => h.id === id ? { ...h, checked: !h.checked } : h),
    }));
  };

  const totalMinutes = Math.max(
    0,
    Math.round((form.wakeTime.getTime() - form.bedTime.getTime()) / 60000),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}><ActivityIndicator color="#6B5CE7" /></View>
      </SafeAreaView>
    );
  }

  if (!originalLog) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>記録が見つかりません</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
        <Text style={styles.title}>記録を編集</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>削除</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            disabled={isSaving}
          >
            <Text style={styles.saveText}>{isSaving ? '保存中' : '保存'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 睡眠時間プレビュー */}
        <View style={styles.durationPreview}>
          <Text style={styles.durationValue}>
            {Math.floor(totalMinutes / 60)}時間{totalMinutes % 60}分
          </Text>
          <Text style={styles.durationLabel}>睡眠時間</Text>
        </View>

        {/* 就寝・起床 */}
        <SectionCard title="就寝・起床時刻">
          <TimePickerRow
            label="就寝"
            value={form.bedTime}
            onChange={d => setForm(prev => ({ ...prev, bedTime: d }))}
          />
          <TimePickerRow
            label="起床"
            value={form.wakeTime}
            onChange={d => setForm(prev => ({ ...prev, wakeTime: d }))}
          />
        </SectionCard>

        {/* 寝つき */}
        <SectionCard title="寝つきはどうでしたか？">
          <View style={styles.optionRow}>
            {SLEEP_ONSET_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionChip, form.sleepOnset === opt.value && styles.optionChipActive]}
                onPress={() => setForm(prev => ({ ...prev, sleepOnset: opt.value }))}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, form.sleepOnset === opt.value && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* 目覚め */}
        <SectionCard title="目覚めはどうでしたか？">
          <View style={styles.optionRow}>
            {WAKE_FEELING_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionChip, form.wakeFeeling === opt.value && styles.optionChipActive]}
                onPress={() => setForm(prev => ({ ...prev, wakeFeeling: opt.value }))}
              >
                <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                <Text style={[styles.optionLabel, form.wakeFeeling === opt.value && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* 習慣 */}
        <SectionCard title="習慣チェック">
          {form.habits.map(habit => (
            <HabitCheckRow key={habit.id} habit={habit} onToggle={() => toggleHabit(habit.id)} />
          ))}
        </SectionCard>

        {/* メモ */}
        <SectionCard title="メモ（任意）">
          <TextInput
            style={styles.memoInput}
            value={form.memo}
            onChangeText={text => setForm(prev => ({ ...prev, memo: text }))}
            placeholder="気になったことを記録..."
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </SectionCard>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const SLEEP_ONSET_OPTIONS: Array<{ value: SleepOnset; label: string; emoji: string }> = [
  { value: 'FAST', label: 'すぐ寝れた', emoji: '😴' },
  { value: 'NORMAL', label: '少し時間かかった', emoji: '😐' },
  { value: 'SLOW', label: 'なかなか寝れなかった', emoji: '😫' },
];

const WAKE_FEELING_OPTIONS: Array<{ value: WakeFeeling; label: string; emoji: string }> = [
  { value: 'GOOD', label: 'すっきり', emoji: '😊' },
  { value: 'NORMAL', label: 'ふつう', emoji: '😐' },
  { value: 'BAD', label: 'つらい', emoji: '😩' },
];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#888', fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
  },
  cancelBtn: { padding: 4 },
  cancelText: { color: '#888', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },
  deleteText: { color: '#F44336', fontSize: 15 },
  saveBtn: { backgroundColor: '#6B5CE7', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1 },
  durationPreview: { alignItems: 'center', paddingVertical: 24 },
  durationValue: { fontSize: 36, fontWeight: 'bold', color: '#6B5CE7' },
  durationLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, color: '#888', fontWeight: '600', marginBottom: 12 },
  optionRow: { flexDirection: 'row', gap: 8 },
  optionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#444',
  },
  optionChipActive: { backgroundColor: '#6B5CE710', borderColor: '#6B5CE7' },
  optionEmoji: { fontSize: 22, marginBottom: 4 },
  optionLabel: { fontSize: 10, color: '#888', textAlign: 'center' },
  optionLabelActive: { color: '#6B5CE7', fontWeight: '600' },
  memoInput: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  spacer: { height: 32 },
});
