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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { addDays, subHours } from 'date-fns';
import { SleepLog, SleepInputForm } from '../../types';
import { getSleepLog, getGoal } from '../../services/firebase';
import { safeToDate } from '../../utils/dateUtils';
import { useSleepStore } from '../../stores/sleepStore';
import TimePickerRow from '../../components/common/TimePickerRow';
import HabitCheckRow from '../../components/diary/HabitCheckRow';
import SubjectiveScaleInput from '../../components/common/SubjectiveScaleInput';
import { i18n, useTranslation } from '../../i18n';
import {
  getSleepOnsetOptions,
  getWakeFeelingOptions,
} from '../../utils/sleepSubjective';
import { MORNING_THEME } from '../../theme/morningTheme';

type SharedParamList = { RecordEdit: { date: string } };
type Props = NativeStackScreenProps<SharedParamList, 'RecordEdit'>;

export default function RecordEditScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const { saveLog, deleteLog } = useSleepStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [originalLog, setOriginalLog] = useState<SleepLog | null>(null);
  const { t } = useTranslation();
  const isJa = i18n.language === 'ja';

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
    Alert.alert(t('recordEdit.deleteConfirmTitle'), t('recordEdit.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLog(date);
            navigation.pop(2);
          } catch {
            Alert.alert(t('recordEdit.deleteFailedTitle'), t('recordEdit.deleteFailedMessage'));
          }
        },
      },
    ]);
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
    setIsSaving(true);
    try {
      const goal = await getGoal();
      await saveLog(
        correctedForm,
        goal ?? { targetHours: 7.5, targetScore: 80, bedTimeTarget: null, updatedAt: null },
        originalLog?.source ?? 'MANUAL',
        date,
        { generateInsight: false },
      );
      navigation.goBack();
    } catch {
      Alert.alert(t('recordEdit.saveFailedTitle'), t('common.saveFailed'));
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

  const totalMinutes = Math.max(
    0,
    Math.round((resolvedWakeTime.getTime() - form.bedTime.getTime()) / 60000),
  );

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
  const actionsTitle = isJa ? '行動チェック' : t('recordEdit.habitsTitle');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color={MORNING_THEME.goldStrong} />
        </View>
      </SafeAreaView>
    );
  }

  if (!originalLog) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('recordEdit.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isJa ? '睡眠記録を編集' : t('recordEdit.title')}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>{t('common.delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              disabled={isSaving}
            >
              <Text style={styles.saveText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.durationPreview}>
            <Text style={styles.durationValue}>
              {isJa
                ? `${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分`
                : `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60}m`}
            </Text>
            <Text style={styles.durationLabel}>{isJa ? '睡眠時間' : t('common.sleepDuration')}</Text>
          </View>

          <SectionCard title={isJa ? '就寝時間・起床時間' : t('sleepInput.bedWakeTitle')}>
            <TimePickerRow
              label={isJa ? '就寝時間' : t('common.bedTime')}
              value={form.bedTime}
              onChange={nextDate => setForm(prev => {
                const diffMs = prev.wakeTime.getTime() - nextDate.getTime();
                const corrected = diffMs > 24 * 60 * 60 * 1000 ? addDays(nextDate, 1) : nextDate;
                return { ...prev, bedTime: corrected };
              })}
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

          <SectionCard title={actionsTitle}>
            {form.habits.map(habit => (
              <HabitCheckRow key={habit.id} habit={habit} onToggle={() => toggleHabit(habit.id)} />
            ))}
          </SectionCard>

          <SectionCard title={isJa ? 'メモ（任意）' : t('common.memoOptional')}>
            <TextInput
              style={styles.memoInput}
              value={form.memo}
              onChangeText={text => setForm(prev => ({ ...prev, memo: text }))}
              placeholder={isJa ? '気づいたことを記録できます' : t('common.memoPlaceholder')}
              placeholderTextColor={MORNING_THEME.textMuted}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </SectionCard>

          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: MORNING_THEME.root },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: MORNING_THEME.textMuted, fontSize: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: MORNING_THEME.borderSoft,
  },
  cancelBtn: { padding: 4 },
  cancelText: { color: MORNING_THEME.textMuted, fontSize: 15 },
  title: { fontSize: 17, fontWeight: '600', color: MORNING_THEME.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },
  deleteText: { color: MORNING_THEME.danger, fontSize: 15 },
  saveBtn: {
    backgroundColor: MORNING_THEME.gold,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MORNING_THEME.goldBorder,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: MORNING_THEME.goldText, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  scroll: { flex: 1 },
  durationPreview: { alignItems: 'center', paddingVertical: 24 },
  durationValue: { fontSize: 36, fontWeight: 'bold', color: MORNING_THEME.goldStrong },
  durationLabel: { fontSize: 13, color: MORNING_THEME.textMuted, marginTop: 4 },
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: MORNING_THEME.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MORNING_THEME.borderSoft,
  },
  sectionTitle: { fontSize: 14, color: MORNING_THEME.textMuted, fontWeight: '600', marginBottom: 12 },
  memoInput: {
    color: MORNING_THEME.textPrimary,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  spacer: { height: 32 },
});
