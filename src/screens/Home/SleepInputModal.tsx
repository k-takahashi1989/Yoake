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
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { SleepLog, SleepInputForm, SleepOnset, WakeFeeling, HabitEntry, UserGoal } from '../../types';
import { useTranslation } from '../../i18n';
import { useSleepStore } from '../../stores/sleepStore';
import { useHabitStore } from '../../stores/habitStore';
import TimePickerRow from '../../components/common/TimePickerRow';
import HabitCheckRow from '../../components/diary/HabitCheckRow';
import { hasHCSleepPermission, readSleepForDate, HCSleepData } from '../../services/healthConnect';
import { safeToDate } from '../../utils/dateUtils';
import ScalePressable from '../../components/common/ScalePressable';
import { haptics } from '../../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  existingLog: SleepLog | null;
  goal: UserGoal | null;
  targetDate?: string; // 省略時は今日
  onSave?: () => void; // 保存成功後に呼ばれるコールバック
}

type SourceMode = 'loading' | 'hc' | 'manual';

export default function SleepInputModal({ visible, onClose, existingLog, goal, targetDate, onSave }: Props) {
  const { t } = useTranslation();
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
      Alert.alert(t('sleepInput.hcTimeoutTitle'), t('sleepInput.hcTimeoutMessage'));
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
      // 保存成功後に触覚フィードバックを発火し、onSave コールバックを呼び出す
      haptics.success();
      onSave?.();
      onClose();
    } catch {
      Alert.alert(t('recordEdit.saveFailedTitle'), t('sleepInput.saveFailed'));
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
      <ImageBackground
        source={require('../../assets/images/bg_home.png')}
        style={styles.container}
        resizeMode="cover"
      >
        {/* ホーム画面と同じ背景を暗めのオーバーレイで薄く見せる */}
        <View style={styles.bgOverlay} />
        <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isToday
              ? t('sleepInput.titleToday')
              : t('sleepInput.titlePast', { date: format(targetDateObj, 'M月d日（EEE）', { locale: ja }) })}
          </Text>
          <ScalePressable
            onPress={handleSave}
            style={[styles.saveBtn, (isSaving || sourceMode === 'loading') && styles.saveBtnDisabled]}
            disabled={isSaving || sourceMode === 'loading'}
            scaleValue={0.94}
          >
            <Text style={styles.saveText}>{isSaving ? t('common.saving') : t('common.save')}</Text>
          </ScalePressable>
        </View>

        {sourceMode === 'loading' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6B5CE7" />
            <Text style={styles.loadingText}>{t('sleepInput.loadingHC')}</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 過去日バナー */}
            {!isToday && (
              <View style={styles.pastDateBanner}>
                <Text style={styles.pastDateText}>
                  {t('sleepInput.pastDateBanner', { date: format(targetDateObj, 'M月d日（EEE）', { locale: ja }) })}
                </Text>
              </View>
            )}

            {/* 就寝時刻が前日にまたがるバナー（今日モーダルのみ） */}
            {isToday && format(form.bedTime, 'yyyy-MM-dd') !== todayStr && (
              <View style={styles.bedDateBanner}>
                <Text style={styles.bedDateText}>
                  {t('sleepInput.bedDateBanner', { date: format(form.bedTime, 'M月d日（EEE）', { locale: ja }) })}
                </Text>
              </View>
            )}

            {/* HC ソースバッジ */}
            {sourceMode === 'hc' && (
              <View style={styles.hcBanner}>
                <Text style={styles.hcBannerText}>{t('sleepInput.hcBanner')}</Text>
                <TouchableOpacity onPress={switchToManual}>
                  <Text style={styles.hcBannerSwitch}>{t('sleepInput.switchManual')}</Text>
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
              <SectionCard title={t('sleepInput.sleepStageTitle')}>
                <View style={styles.stageRow}>
                  <StageItem label={t('sleepInput.deepSleep')} minutes={form.deepSleepMinutes ?? 0} color="#6B5CE7" />
                  <StageItem label={t('sleepInput.remSleep')} minutes={form.remMinutes ?? 0} color="#4CAF50" />
                  <StageItem label={t('sleepInput.lightSleep')} minutes={form.lightSleepMinutes ?? 0} color="#FF9800" />
                  <StageItem label={t('sleepInput.awake')} minutes={form.awakenings ?? 0} color="#F44336" isCount />
                </View>
              </SectionCard>
            )}

            {/* 就寝・起床時刻 */}
            <SectionCard title={t('sleepInput.bedWakeTitle')}>
              <TimePickerRow
                label={t('common.bedTime')}
                value={form.bedTime}
                onChange={d => setForm(prev => ({ ...prev, bedTime: d }))}
              />
              <TimePickerRow
                label={t('common.wakeTime')}
                value={form.wakeTime}
                onChange={d => setForm(prev => ({ ...prev, wakeTime: d }))}
              />
            </SectionCard>

            {/* 寝つき */}
            <SectionCard title={t('sleepInput.sleepOnsetTitle')}>
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
                    ]}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            {/* 目覚め */}
            <SectionCard title={t('sleepInput.wakeFeelingTitle')}>
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
                    ]}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>

            {/* 習慣チェック */}
            <SectionCard title={t('sleepInput.habitsTitle')}>
              {form.habits.map(habit => (
                <HabitCheckRow
                  key={habit.id}
                  habit={habit}
                  onToggle={() => toggleHabit(habit.id)}
                />
              ))}
            </SectionCard>

            {/* メモ */}
            <SectionCard title={t('common.memoOptional')}>
              <TextInput
                style={styles.memoInput}
                value={form.memo}
                onChangeText={text => setForm(prev => ({ ...prev, memo: text }))}
                placeholder={t('common.memoPlaceholder')}
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </SectionCard>

            <View style={styles.spacer} />
          </ScrollView>
        )}
        </KeyboardAvoidingView>
        </SafeAreaView>
      </ImageBackground>
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

const SLEEP_ONSET_OPTIONS: Array<{ value: SleepOnset; labelKey: string; emoji: string }> = [
  { value: 'FAST', labelKey: 'sleepInput.onsetFast', emoji: '😴' },
  { value: 'NORMAL', labelKey: 'sleepInput.onsetNormal', emoji: '😐' },
  { value: 'SLOW', labelKey: 'sleepInput.onsetSlow', emoji: '😫' },
];

const WAKE_FEELING_OPTIONS: Array<{ value: WakeFeeling; labelKey: string; emoji: string }> = [
  { value: 'GOOD', labelKey: 'sleepInput.wakeFeelingGood', emoji: '😊' },
  { value: 'NORMAL', labelKey: 'sleepInput.wakeFeelingNormal', emoji: '😐' },
  { value: 'BAD', labelKey: 'sleepInput.wakeFeelingBad', emoji: '😩' },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 同じ背景画像を18%透けさせる暗オーバーレイ
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13, 10, 35, 0.82)' },
  safeArea: { flex: 1, backgroundColor: 'transparent' },
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
  cancelText: { color: '#9A9AB8', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  saveBtn: { backgroundColor: '#6B5CE7', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#9A9AB8', fontSize: 14 },
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
  bedDateBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#4FC3F715',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#4FC3F740',
  },
  bedDateText: { color: '#4FC3F7', fontSize: 13, textAlign: 'center' },
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
  durationLabel: { fontSize: 13, color: '#9A9AB8', marginTop: 4 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stageItem: { alignItems: 'center' },
  stageValue: { fontSize: 16, fontWeight: 'bold' },
  stageLabel: { fontSize: 10, color: '#9A9AB8', marginTop: 4 },
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#9A9AB8',
    fontWeight: '600',
    marginBottom: 12,
    backgroundColor: 'rgba(107, 92, 231, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: -16,
    marginTop: -16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
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
  optionLabel: { fontSize: 10, color: '#9A9AB8', textAlign: 'center' },
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
