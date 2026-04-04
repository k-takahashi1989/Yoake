import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addDays, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { SleepLog, SleepInputForm, UserGoal } from '../../types';
import { i18n, useTranslation } from '../../i18n';
import { useSleepStore } from '../../stores/sleepStore';
import { useHabitStore } from '../../stores/habitStore';
import TimePickerRow from '../../components/common/TimePickerRow';
import HabitCheckRow from '../../components/diary/HabitCheckRow';
import { hasSleepDataPermission, readSleepDataForDate } from '../../services/healthData';
import { safeToDate } from '../../utils/dateUtils';
import {
  clearPendingSleepStart,
  getPendingSleepStart,
} from '../../services/notificationService';
import ScalePressable from '../../components/common/ScalePressable';
import SubjectiveScaleInput from '../../components/common/SubjectiveScaleInput';
import { haptics } from '../../utils/haptics';
import {
  getSleepOnsetOptions,
  getWakeFeelingOptions,
} from '../../utils/sleepSubjective';

interface Props {
  visible: boolean;
  onClose: () => void;
  existingLog: SleepLog | null;
  goal: UserGoal | null;
  targetDate?: string;
  onSave?: () => void;
}

type SourceMode = 'loading' | 'hc' | 'manual';

function buildDefaultBedTime(date: string, isToday: boolean): Date {
  if (isToday) {
    const value = new Date();
    value.setHours(value.getHours() - 8, 0, 0, 0);
    return value;
  }

  const value = safeToDate(date);
  value.setDate(value.getDate() - 1);
  value.setHours(23, 0, 0, 0);
  return value;
}

function buildDefaultWakeTime(date: string, isToday: boolean): Date {
  if (isToday) {
    const value = new Date();
    value.setMinutes(0, 0, 0);
    return value;
  }

  const value = safeToDate(date);
  value.setHours(7, 0, 0, 0);
  return value;
}

export default function SleepInputModal({
  visible,
  onClose,
  existingLog,
  goal,
  targetDate,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const { saveLog } = useSleepStore();
  const { getActiveEntries, isLoaded: habitsLoaded, loadHabits } = useHabitStore();
  const [isSaving, setIsSaving] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>('loading');
  const isJa = i18n.language === 'ja';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = targetDate ?? todayStr;
  const isToday = today === todayStr;
  const targetDateObj = safeToDate(today);
  const targetDateLabel = format(targetDateObj, isJa ? 'M月d日 (EEE)' : 'MMM d (EEE)', { locale: ja });

  const defaultBedTime = useMemo(() => buildDefaultBedTime(today, isToday), [today, isToday]);
  const defaultWakeTime = useMemo(() => buildDefaultWakeTime(today, isToday), [today, isToday]);

  const [form, setForm] = useState<SleepInputForm>({
    bedTime: defaultBedTime,
    wakeTime: defaultWakeTime,
    sleepOnset: 'NORMAL',
    wakeFeeling: 'NORMAL',
    habits: getActiveEntries(),
    memo: '',
  });

  const getPendingBedTimeForTarget = async (date: string) => {
    const pending = await getPendingSleepStart();
    if (!pending) return null;

    const nextDay = format(addDays(pending.bedTime, 1), 'yyyy-MM-dd');
    return nextDay === date ? pending.bedTime : null;
  };

  useEffect(() => {
    if (!habitsLoaded) {
      loadHabits();
    }
  }, [habitsLoaded, loadHabits]);

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

    setForm(prev => ({ ...prev, habits: getActiveEntries() }));

    const loadInitialForm = async () => {
      const pendingBedTime = await getPendingBedTimeForTarget(today);
      setForm({
        bedTime: pendingBedTime ?? defaultBedTime,
        wakeTime: defaultWakeTime,
        sleepOnset: 'NORMAL',
        wakeFeeling: 'NORMAL',
        habits: getActiveEntries(),
        memo: '',
      });

      setSourceMode('loading');
      const timeoutId = setTimeout(() => {
        setSourceMode('manual');
        Alert.alert(
          isJa ? 'タイムアウト' : t('sleepInput.hcTimeoutTitle'),
          isJa
            ? 'Health Connect からの読み込みに時間がかかったため、手動入力に切り替えました。'
            : t('sleepInput.hcTimeoutMessage'),
        );
      }, 5000);

      try {
        const permitted = await hasSleepDataPermission();
        if (!permitted) {
          clearTimeout(timeoutId);
          setSourceMode('manual');
          return;
        }

        const data = await readSleepDataForDate(today);
        clearTimeout(timeoutId);
        if (data) {
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

    loadInitialForm().catch(() => {
      setSourceMode('manual');
    });
  }, [defaultBedTime, defaultWakeTime, existingLog, getActiveEntries, isJa, t, today, visible]);

  const switchToManual = () => {
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
    const saveTargetDate = targetDate ?? todayStr;
    setIsSaving(true);
    const source = sourceMode === 'hc' ? 'HEALTH_CONNECT' : 'MANUAL';

    try {
      await saveLog(
        correctedForm,
        goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null as any },
        source,
        saveTargetDate,
        { generateInsight: !existingLog },
      );

      const pendingBedTime = await getPendingBedTimeForTarget(saveTargetDate);
      if (pendingBedTime) {
        await clearPendingSleepStart();
      }

      haptics.success();
      onSave?.();
      onClose();
    } catch {
      Alert.alert(
        isJa ? '保存に失敗しました' : t('recordEdit.saveFailedTitle'),
        isJa ? '睡眠記録を保存できませんでした。' : t('sleepInput.saveFailed'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const toggleHabit = (id: string) => {
    setForm(prev => ({
      ...prev,
      habits: prev.habits.map(habit => (habit.id === id ? { ...habit, checked: !habit.checked } : habit)),
    }));
  };

  const totalMinutes = Math.round((resolvedWakeTime.getTime() - form.bedTime.getTime()) / 60000);
  const durationHours = Math.floor(totalMinutes / 60);
  const durationMinutes = totalMinutes % 60;
  const durationText = isJa
    ? `${durationHours}時間${durationMinutes}分`
    : `${durationHours}h${durationMinutes}m`;
  const titleText = isToday
    ? (isJa ? '睡眠記録' : t('sleepInput.titleToday'))
    : (isJa ? `${targetDateLabel}の記録` : t('sleepInput.titlePast', { date: targetDateLabel }));
  const pastDateBannerText = isJa
    ? `${targetDateLabel}の睡眠記録を保存します。`
    : t('sleepInput.pastDateBanner', { date: targetDateLabel });
  const bedDateLabel = format(form.bedTime, isJa ? 'M月d日 (EEE)' : 'MMM d (EEE)', { locale: ja });
  const bedDateBannerText = isJa
    ? `就寝時刻が ${bedDateLabel} のログとして保存されます。`
    : t('sleepInput.bedDateBanner', { date: bedDateLabel });
  const sleepOnsetOptions = isJa
    ? [
        { value: 'FAST' as const, label: 'すぐ寝れた' },
        { value: 'SLIGHTLY_FAST' as const, label: 'やや早く寝れた' },
        { value: 'NORMAL' as const, label: 'ふつう' },
        { value: 'SLIGHTLY_SLOW' as const, label: 'やや寝つきに時間がかかった' },
        { value: 'SLOW' as const, label: '寝つきに時間がかかった' },
      ]
    : getSleepOnsetOptions(t);
  const wakeFeelingOptions = isJa
    ? [
        { value: 'GOOD' as const, label: 'すっきり' },
        { value: 'SLIGHTLY_GOOD' as const, label: 'ややすっきり' },
        { value: 'NORMAL' as const, label: 'ふつう' },
        { value: 'SLIGHTLY_BAD' as const, label: 'やや重い' },
        { value: 'BAD' as const, label: '重い' },
      ]
    : getWakeFeelingOptions(t);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ImageBackground
        source={require('../../assets/images/bg_home.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.bgOverlay} />
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{isJa ? 'キャンセル' : t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{titleText}</Text>
              <ScalePressable
                onPress={handleSave}
                style={[styles.saveBtn, (isSaving || sourceMode === 'loading') && styles.saveBtnDisabled]}
                disabled={isSaving || sourceMode === 'loading'}
                scaleValue={0.94}
              >
                <Text style={styles.saveText}>{isSaving ? (isJa ? '保存中' : t('common.saving')) : (isJa ? '保存' : t('common.save'))}</Text>
              </ScalePressable>
            </View>

            {sourceMode === 'loading' ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6B5CE7" />
                <Text style={styles.loadingText}>
                  {isJa ? 'Health Connect からデータを読み込み中...' : t('sleepInput.loadingHC')}
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {!isToday && (
                  <View style={styles.pastDateBanner}>
                    <Text style={styles.pastDateText}>{pastDateBannerText}</Text>
                  </View>
                )}

                {isToday && format(form.bedTime, 'yyyy-MM-dd') !== todayStr && (
                  <View style={styles.bedDateBanner}>
                    <Text style={styles.bedDateText}>{bedDateBannerText}</Text>
                  </View>
                )}

                {sourceMode === 'hc' && (
                  <View style={styles.hcBanner}>
                    <Text style={styles.hcBannerText}>
                      {isJa ? 'Health Connect から取り込み済み' : t('sleepInput.hcBanner')}
                    </Text>
                    <TouchableOpacity onPress={switchToManual}>
                      <Text style={styles.hcBannerSwitch}>
                        {isJa ? '手動入力に切り替え' : t('sleepInput.switchManual')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.durationPreview}>
                  <Text style={styles.durationValue}>{durationText}</Text>
                  <Text style={styles.durationLabel}>{isJa ? '睡眠時間' : t('common.sleepDuration')}</Text>
                </View>

                {sourceMode === 'hc' && form.deepSleepMinutes != null && (
                  <SectionCard title={isJa ? '睡眠ステージ（Health Connect）' : t('sleepInput.sleepStageTitle')}>
                    <View style={styles.stageRow}>
                      <StageItem label={isJa ? '深い睡眠' : t('sleepInput.deepSleep')} minutes={form.deepSleepMinutes ?? 0} color="#6B5CE7" />
                      <StageItem label={isJa ? 'レム睡眠' : t('sleepInput.remSleep')} minutes={form.remMinutes ?? 0} color="#4CAF50" />
                      <StageItem label={isJa ? '浅い睡眠' : t('sleepInput.lightSleep')} minutes={form.lightSleepMinutes ?? 0} color="#FF9800" />
                      <StageItem label={isJa ? '覚醒' : t('sleepInput.awake')} minutes={form.awakenings ?? 0} color="#F44336" isCount />
                    </View>
                  </SectionCard>
                )}

                <SectionCard title={isJa ? '就寝時間・起床時間' : t('sleepInput.bedWakeTitle')}>
                  <TimePickerRow
                    label={isJa ? '就寝時間' : t('common.bedTime')}
                    value={form.bedTime}
                    onChange={nextDate => setForm(prev => ({ ...prev, bedTime: nextDate }))}
                  />
                  <TimePickerRow
                    label={isJa ? '起床時間' : t('common.wakeTime')}
                    value={form.wakeTime}
                    onChange={nextDate => setForm(prev => ({ ...prev, wakeTime: nextDate }))}
                  />
                </SectionCard>

                <SectionCard title={isJa ? '寝つきはどうでしたか？' : t('sleepInput.sleepOnsetTitle')}>
                  <SubjectiveScaleInput
                    options={sleepOnsetOptions}
                    value={form.sleepOnset}
                    onChange={nextValue => setForm(prev => ({ ...prev, sleepOnset: nextValue }))}
                  />
                </SectionCard>

                <SectionCard title={isJa ? '目覚めはどうでしたか？' : t('sleepInput.wakeFeelingTitle')}>
                  <SubjectiveScaleInput
                    options={wakeFeelingOptions}
                    value={form.wakeFeeling}
                    onChange={nextValue => setForm(prev => ({ ...prev, wakeFeeling: nextValue }))}
                  />
                </SectionCard>

                <SectionCard title={isJa ? '行動チェック' : t('sleepInput.habitsTitle')}>
                  {form.habits.map(habit => (
                    <HabitCheckRow
                      key={habit.id}
                      habit={habit}
                      onToggle={() => toggleHabit(habit.id)}
                    />
                  ))}
                </SectionCard>

                <SectionCard title={isJa ? 'メモ（任意）' : t('common.memoOptional')}>
                  <TextInput
                    style={styles.memoInput}
                    value={form.memo}
                    onChangeText={text => setForm(prev => ({ ...prev, memo: text }))}
                    placeholder={isJa ? '気づいたことを記録できます' : t('common.memoPlaceholder')}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  memoInput: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 22,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  spacer: { height: 32 },
});
