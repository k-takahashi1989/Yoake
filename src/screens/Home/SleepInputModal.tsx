import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { SleepLog, SleepInputForm, SleepOnset, WakeFeeling, HabitEntry, UserGoal } from '../../types';
import { useSleepStore } from '../../stores/sleepStore';
import { useHabitStore } from '../../stores/habitStore';
import TimePickerRow from '../../components/common/TimePickerRow';
import HabitCheckRow from '../../components/diary/HabitCheckRow';
import { hasHCSleepPermission, readSleepForDate, HCSleepData } from '../../services/healthConnect';
import { safeToDate } from '../../utils/dateUtils';

interface Props {
  visible: boolean;
  onClose: () => void;
  existingLog: SleepLog | null;
  goal: UserGoal | null;
  targetDate?: string; // 省略時は今日
}

type SourceMode = 'loading' | 'hc' | 'manual';

export default function SleepInputModal({ visible, onClose, existingLog, goal, targetDate }: Props) {
  const { saveLog } = useSleepStore();
  const { getActiveEntries, isLoaded: habitsLoaded, loadHabits } = useHabitStore();
  const [isSaving, setIsSaving] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>('loading');
  const [hcData, setHcData] = useState<HCSleepData | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = targetDate ?? todayStr;
  const isToday = today === todayStr;

  const targetDateObj = new Date(today.replace(/-/g, '/'));

  // 今日なら「8時間前〜今」、過去日なら「前夜23時〜当日7時」をデフォルトに
  const defaultBedTime = (() => {
    if (isToday) {
      const d = new Date();
      d.setHours(d.getHours() - 8, 0, 0, 0);
      return d;
    }
    const d = new Date(targetDateObj);
    d.setDate(d.getDate() - 1);
    d.setHours(23, 0, 0, 0);
    return d;
  })();

  const defaultWakeTime = (() => {
    if (isToday) {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      return d;
    }
    const d = new Date(targetDateObj);
    d.setHours(7, 0, 0, 0);
    return d;
  })();

  const [form, setForm] = useState<SleepInputForm>({
    bedTime: defaultBedTime,
    wakeTime: defaultWakeTime,
    sleepOnset: 'NORMAL',
    wakeFeeling: 'NORMAL',
    habits: getActiveEntries(),
    memo: '',
  });

  // 習慣テンプレートを初回ロード
  useEffect(() => {
    if (!habitsLoaded) loadHabits();
  }, []);

  // モーダルが開いたとき、既存ログまたは HC データで初期化
  useEffect(() => {
    if (!visible) return;

    if (existingLog) {
      setForm({
        bedTime: safeToDate(existingLog.bedTime),
        wakeTime: safeToDate(existingLog.wakeTime),
        sleepOnset: existingLog.sleepOnset,
        wakeFeeling: existingLog.wakeFeeling,
        habits: existingLog.habits,
        memo: existingLog.memo ?? '',
        deepSleepMinutes: existingLog.deepSleepMinutes,
        remMinutes: existingLog.remMinutes,
        lightSleepMinutes: existingLog.lightSleepMinutes,
        awakenings: existingLog.awakenings,
        heartRateAvg: existingLog.heartRateAvg,
      });
      setSourceMode(existingLog.source === 'HEALTH_CONNECT' ? 'hc' : 'manual');
      return;
    }

    // 新規記録: 習慣テンプレートをリセットしてから HC を試みる
    setForm(prev => ({ ...prev, habits: getActiveEntries() }));
    loadHCData();
  }, [visible]);

  const loadHCData = async () => {
    setSourceMode('loading');
    const timeoutId = setTimeout(() => {
      setSourceMode('manual');
      Alert.alert('タイムアウト', 'Health Connectからのデータ取得に失敗しました。手動で入力してください。');
    }, 5000);
    try {
      const permitted = await hasHCSleepPermission();
      if (!permitted) {
        clearTimeout(timeoutId);
        setSourceMode('manual');
        return;
      }

      const data = await readSleepForDate(today);
      clearTimeout(timeoutId);
      if (data) {
        setHcData(data);
        setForm(prev => ({
          ...prev,
          bedTime: data.bedTime,
          wakeTime: data.wakeTime,
          deepSleepMinutes: data.deepSleepMinutes,
          remMinutes: data.remMinutes,
          lightSleepMinutes: data.lightSleepMinutes,
          awakenings: data.awakenings,
          heartRateAvg: data.heartRateAvg,
        }));
        setSourceMode('hc');
      } else {
        setSourceMode('manual');
      }
    } catch {
      clearTimeout(timeoutId);
      setSourceMode('manual');
    }
  };

  const switchToManual = () => {
    setHcData(null);
    setForm(prev => ({
      ...prev,
      deepSleepMinutes: null,
      remMinutes: null,
      lightSleepMinutes: null,
      awakenings: null,
      heartRateAvg: null,
    }));
    setSourceMode('manual');
  };

  // 日またぎ対応: 起床時刻が就寝時刻より前なら翌日扱い
  const resolvedWakeTime = (() => {
    if (form.wakeTime <= form.bedTime) {
      const next = new Date(form.wakeTime);
      next.setDate(next.getDate() + 1);
      return next;
    }
    return form.wakeTime;
  })();

  const handleSave = async () => {
    const correctedForm = { ...form, wakeTime: resolvedWakeTime };
    setIsSaving(true);
    const source = sourceMode === 'hc' ? 'HEALTH_CONNECT' : 'MANUAL';
    try {
      await saveLog(
        correctedForm,
        goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null as any },
        source,
      );
      onClose();
    } catch {
      Alert.alert('保存失敗', '記録の保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHabit = (id: string) => {
    setForm(prev => ({
      ...prev,
      habits: prev.habits.map(h => (h.id === id ? { ...h, checked: !h.checked } : h)),
    }));
  };

  const totalMinutes = Math.round(
    (resolvedWakeTime.getTime() - form.bedTime.getTime()) / 60000,
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isToday
              ? '睡眠記録'
              : format(targetDateObj, 'M月d日（EEE）', { locale: ja }) + ' の記録'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, (isSaving || sourceMode === 'loading') && styles.saveBtnDisabled]}
            disabled={isSaving || sourceMode === 'loading'}
          >
            <Text style={styles.saveText}>{isSaving ? '保存中' : '保存'}</Text>
          </TouchableOpacity>
        </View>

        {sourceMode === 'loading' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B5CE7" />
            <Text style={styles.loadingText}>Health Connect からデータを取得中...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* 過去日バナー */}
            {!isToday && (
              <View style={styles.pastDateBanner}>
                <Text style={styles.pastDateText}>
                  📅 {format(targetDateObj, 'M月d日（EEE）', { locale: ja })} の睡眠を記録しています
                </Text>
              </View>
            )}

            {/* HC ソースバッジ */}
            {sourceMode === 'hc' && (
              <View style={styles.hcBanner}>
                <Text style={styles.hcBannerText}>❤️ Health Connect から自動取得</Text>
                <TouchableOpacity onPress={switchToManual}>
                  <Text style={styles.hcBannerSwitch}>手動入力に切替</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 睡眠時間プレビュー */}
            <View style={styles.durationPreview}>
              <Text style={styles.durationValue}>
                {Math.floor(totalMinutes / 60)}時間{totalMinutes % 60}分
              </Text>
              <Text style={styles.durationLabel}>睡眠時間</Text>
            </View>

            {/* HC ステージ情報 */}
            {sourceMode === 'hc' && form.deepSleepMinutes != null && (
              <SectionCard title="睡眠ステージ（Health Connect）">
                <View style={styles.stageRow}>
                  <StageItem label="深睡眠" minutes={form.deepSleepMinutes ?? 0} color="#6B5CE7" />
                  <StageItem label="レム睡眠" minutes={form.remMinutes ?? 0} color="#4CAF50" />
                  <StageItem label="浅い睡眠" minutes={form.lightSleepMinutes ?? 0} color="#FF9800" />
                  <StageItem label="覚醒" minutes={form.awakenings ?? 0} color="#F44336" isCount />
                </View>
              </SectionCard>
            )}

            {/* 就寝・起床時刻 */}
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
                    style={[
                      styles.optionChip,
                      form.sleepOnset === opt.value && styles.optionChipActive,
                    ]}
                    onPress={() => setForm(prev => ({ ...prev, sleepOnset: opt.value }))}
                  >
                    <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                    <Text style={[
                      styles.optionLabel,
                      form.sleepOnset === opt.value && styles.optionLabelActive,
                    ]}>{opt.label}</Text>
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
                    style={[
                      styles.optionChip,
                      form.wakeFeeling === opt.value && styles.optionChipActive,
                    ]}
                    onPress={() => setForm(prev => ({ ...prev, wakeFeeling: opt.value }))}
                  >
                    <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                    <Text style={[
                      styles.optionLabel,
                      form.wakeFeeling === opt.value && styles.optionLabelActive,
                    ]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            {/* 習慣チェック */}
            <SectionCard title="昨日の習慣">
              {form.habits.map(habit => (
                <HabitCheckRow
                  key={habit.id}
                  habit={habit}
                  onToggle={() => toggleHabit(habit.id)}
                />
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
        )}
      </SafeAreaView>
    </Modal>
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

function StageItem({
  label,
  minutes,
  color,
  isCount,
}: {
  label: string;
  minutes: number;
  color: string;
  isCount?: boolean;
}) {
  return (
    <View style={styles.stageItem}>
      <Text style={[styles.stageValue, { color }]}>
        {isCount ? `${minutes}回` : `${Math.floor(minutes / 60)}h${minutes % 60}m`}
      </Text>
      <Text style={styles.stageLabel}>{label}</Text>
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
  container: { flex: 1, backgroundColor: '#1A1A2E' },
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
  saveBtn: { backgroundColor: '#6B5CE7', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#888', fontSize: 14 },
  scroll: { flex: 1 },
  pastDateBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FF980015',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FF980040',
  },
  pastDateText: { color: '#FF9800', fontSize: 13, textAlign: 'center' },
  hcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#6B5CE720',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#6B5CE740',
  },
  hcBannerText: { color: '#9C8FFF', fontSize: 13, fontWeight: '600' },
  hcBannerSwitch: { color: '#666', fontSize: 12, textDecorationLine: 'underline' },
  durationPreview: { alignItems: 'center', paddingVertical: 24 },
  durationValue: { fontSize: 36, fontWeight: 'bold', color: '#6B5CE7' },
  durationLabel: { fontSize: 13, color: '#888', marginTop: 4 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stageItem: { alignItems: 'center' },
  stageValue: { fontSize: 16, fontWeight: 'bold' },
  stageLabel: { fontSize: 10, color: '#888', marginTop: 4 },
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
