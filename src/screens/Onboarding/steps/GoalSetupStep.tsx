import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import ScalePressable from '../../../components/common/ScalePressable';
import { useTranslation } from '../../../i18n';
import { saveGoal } from '../../../services/firebase';
import { useAuthStore } from '../../../stores/authStore';

interface Props {
  onNext: () => void;
}

const SLEEP_HOUR_OPTIONS = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];
const SCORE_OPTIONS = [65, 70, 75, 80, 85, 90];
const BEDTIME_OPTIONS = [
  '21:00',
  '21:30',
  '22:00',
  '22:30',
  '23:00',
  '23:30',
  '00:00',
  '00:30',
  '01:00',
  '01:30',
  '02:00',
];

interface SelectRowProps<T> {
  label: string;
  value: T;
  options: T[];
  renderLabel: (value: T) => string;
  onChange: (value: T) => void;
  nullable?: boolean;
  nullLabel?: string;
}

function SelectRow<T>({
  label,
  value,
  options,
  renderLabel,
  onChange,
  nullable,
  nullLabel,
}: SelectRowProps<T>) {
  const [open, setOpen] = useState(false);
  const displayValue =
    value === null ? (nullLabel ?? 'Not set') : renderLabel(value);

  return (
    <>
      <TouchableOpacity
        style={styles.selectRow}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectLabel}>{label}</Text>
        <View style={styles.selectValue}>
          <Text style={styles.selectValueText}>{displayValue}</Text>
          <Text style={styles.chevron}>{'>'}</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <FlatList
                  data={
                    nullable
                      ? ([null, ...options] as Array<T | null>)
                      : (options as Array<T | null>)
                  }
                  keyExtractor={(_, index) => String(index)}
                  renderItem={({ item }) => {
                    const isSelected = item === value;
                    const optionLabel =
                      item === null
                        ? (nullLabel ?? 'Not set')
                        : renderLabel(item as T);

                    return (
                      <TouchableOpacity
                        style={[styles.option, isSelected && styles.optionSelected]}
                        onPress={() => {
                          onChange(item as T);
                          setOpen(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextSelected,
                          ]}
                        >
                          {optionLabel}
                        </Text>
                        {isSelected && <Text style={styles.checkmark}>OK</Text>}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

export default function GoalSetupStep({ onNext }: Props) {
  const { t } = useTranslation();
  const ensureSignedIn = useAuthStore(state => state.ensureSignedIn);
  const [targetHours, setTargetHours] = useState(7.5);
  const [targetScore, setTargetScore] = useState(80);
  const [bedTimeTarget, setBedTimeTarget] = useState<string | null>('23:00');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await ensureSignedIn();
      await saveGoal({
        targetHours,
        targetScore,
        bedTimeTarget,
        updatedAt: firestore.Timestamp.now(),
      });
      onNext();
    } catch (error) {
      console.error('[GoalSetupStep] failed to save goal:', error);
      Alert.alert(t('common.error'), t('common.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('onboarding.goal.title')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.goal.subtitle')}</Text>

      <View style={styles.card}>
        <SelectRow
          label={t('onboarding.goal.sleepHours')}
          value={targetHours}
          options={SLEEP_HOUR_OPTIONS}
          renderLabel={hours => t('onboarding.goal.hoursFormat', { h: hours })}
          onChange={setTargetHours}
        />
        <View style={styles.divider} />
        <SelectRow
          label={t('onboarding.goal.targetScore')}
          value={targetScore}
          options={SCORE_OPTIONS}
          renderLabel={score => t('onboarding.goal.scoreFormat', { s: score })}
          onChange={setTargetScore}
        />
        <View style={styles.divider} />
        <SelectRow
          label={t('onboarding.goal.bedTimeTarget')}
          value={bedTimeTarget}
          options={BEDTIME_OPTIONS}
          renderLabel={value => value ?? ''}
          onChange={setBedTimeTarget}
          nullable
          nullLabel={t('onboarding.goal.notSet')}
        />
      </View>

      <ScalePressable
        style={[styles.button, isSaving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.buttonText}>
          {isSaving ? t('onboarding.goal.saving') : t('common.next')}
        </Text>
      </ScalePressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#9A9AB8',
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  selectLabel: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  selectValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectValueText: { fontSize: 15, color: '#9C8FFF', fontWeight: '600' },
  chevron: { fontSize: 20, color: '#6B5CE7', marginTop: 1 },
  divider: { height: 1, backgroundColor: '#3D3D55', marginHorizontal: 16 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#2D2D44',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '60%',
  },
  sheetTitle: {
    fontSize: 13,
    color: '#9A9AB8',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  optionSelected: { backgroundColor: '#6B5CE720' },
  optionText: { fontSize: 16, color: '#FFFFFF' },
  optionTextSelected: { color: '#9C8FFF', fontWeight: '600' },
  checkmark: { color: '#6B5CE7', fontSize: 12, fontWeight: '700' },
  button: {
    backgroundColor: '#6B5CE7',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
