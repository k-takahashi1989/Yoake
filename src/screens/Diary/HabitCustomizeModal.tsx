import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabitStore } from '../../stores/habitStore';
import { useAuthStore } from '../../stores/authStore';
import { HabitTemplate } from '../../types';
import { FREE_LIMITS } from '../../constants';
import { useTranslation } from '../../i18n';
import HabitIcon from '../../components/common/HabitIcon';
import Icon from '../../components/common/Icon';

function getHabitDisplayLabel(habit: { id: string; label: string }, t: (key: string, opts?: any) => string): string {
  if (habit.id.startsWith('default_')) {
    return t(`habits.${habit.id}`, { defaultValue: habit.label });
  }
  return habit.label;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'list' | 'add';

export default function HabitCustomizeModal({ visible, onClose }: Props) {
  const { templates, addHabit, toggleActive, removeHabit } = useHabitStore();
  const { isPremium } = useAuthStore();
  const [mode, setMode] = useState<Mode>('list');
  const [newLabel, setNewLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useTranslation();

  const customTemplates = templates.filter(tmpl => !tmpl.isDefault);
  const canAddMore = customTemplates.length < FREE_LIMITS.MAX_HABIT_ITEMS;
  const remainingCustomItems = FREE_LIMITS.MAX_HABIT_ITEMS - customTemplates.length;

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      Alert.alert(t('habitCustomize.inputError'), t('habitCustomize.inputErrorMessage'));
      return;
    }
    if (!canAddMore) {
      Alert.alert(t('habitCustomize.limitError'), t('habitCustomize.limitErrorMessage', { max: FREE_LIMITS.MAX_HABIT_ITEMS }));
      return;
    }

    setIsSaving(true);
    try {
      await addHabit(trimmed, '');
      setNewLabel('');
      setMode('list');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (template: HabitTemplate) => {
    const label = getHabitDisplayLabel(template, t);
    Alert.alert(
      t('habitCustomize.deleteConfirmTitle'),
      t('habitCustomize.deleteConfirmMessage', { label }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => removeHabit(template.id),
        },
      ],
    );
  };

  const renderPaywall = () => (
    <View style={styles.paywall}>
      <View style={styles.paywallIconWrap}>
        <Icon name="crown" size={28} color="#D8CC8E" />
      </View>
      <Text style={styles.paywallTitle}>{t('habitCustomize.paywallTitle')}</Text>
      <Text style={styles.paywallDesc}>{t('habitCustomize.paywallDesc')}</Text>
      <Text style={styles.paywallCta}>{t('habitCustomize.paywallCta')}</Text>
    </View>
  );

  const renderHabitRow = ({ item }: { item: HabitTemplate }) => {
    const label = getHabitDisplayLabel(item, t);
    return (
      <View style={styles.habitRow}>
        <HabitIcon habit={item} size={30} />
        <View style={styles.habitInfo}>
          <Text style={styles.habitLabel}>{label}</Text>
          {item.isDefault && <Text style={styles.habitDefault}>{t('habitCustomize.default')}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, item.isActive && styles.toggleBtnActive]}
          onPress={() => toggleActive(item.id)}
        >
          <Text style={[styles.toggleText, item.isActive && styles.toggleTextActive]}>
            {item.isActive ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
        {!item.isDefault && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('habitCustomize.title')}</Text>
          {isPremium && mode === 'list' ? (
            <TouchableOpacity onPress={() => setMode('add')} style={styles.addBtn}>
              <Text style={styles.addText}>{t('habitCustomize.add')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {!isPremium ? (
          renderPaywall()
        ) : mode === 'add' ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
              <View style={styles.addForm}>
                <Text style={styles.formLabel}>{t('habitCustomize.formNameLabel')}</Text>
                <TextInput
                  style={styles.labelInput}
                  value={newLabel}
                  onChangeText={setNewLabel}
                  placeholder={t('habitCustomize.formPlaceholder')}
                  placeholderTextColor="#555"
                  maxLength={20}
                  autoFocus
                />
                <View style={styles.previewWrap}>
                  <Text style={styles.previewLabel}>{t('habitCustomize.default')}</Text>
                  <HabitIcon
                    habit={{ label: newLabel.trim() || t('habitCustomize.formPlaceholder') }}
                    size={36}
                    backgroundColor="rgba(107, 92, 231, 0.18)"
                    borderColor="rgba(107, 92, 231, 0.34)"
                    color="#DCD8FF"
                  />
                </View>
                <View style={styles.addFormButtons}>
                  <TouchableOpacity
                    style={styles.cancelFormBtn}
                    onPress={() => {
                      setMode('list');
                      setNewLabel('');
                    }}
                  >
                    <Text style={styles.cancelFormText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveFormBtn, isSaving && styles.saveFormBtnDisabled]}
                    onPress={handleAdd}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveFormText}>{t('habitCustomize.formAddButton')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <>
            <Text style={styles.hint}>{t('habitCustomize.hint', { count: remainingCustomItems })}</Text>
            <FlatList
              data={templates}
              keyExtractor={item => item.id}
              renderItem={renderHabitRow}
              contentContainerStyle={styles.list}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  flex: { flex: 1 },
  formScroll: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
  },
  closeBtn: { padding: 4, minWidth: 60 },
  closeText: { color: '#9A9AB8', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  addBtn: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 60, alignItems: 'flex-end' },
  addText: { color: '#6B5CE7', fontSize: 15, fontWeight: '600' },
  headerSpacer: { width: 60 },
  hint: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 12, color: '#9A9AB8', lineHeight: 18 }, // WCAG AA対応: #666 → #9A9AB8
  list: { paddingBottom: 24 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D44',
    gap: 10,
  },
  habitInfo: { flex: 1 },
  habitLabel: { fontSize: 15, color: '#FFFFFF' },
  habitDefault: { fontSize: 10, color: '#9A9AB8', marginTop: 2 }, // WCAG AA対応: #666 → #9A9AB8
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2D2D44',
    borderWidth: 1,
    borderColor: '#444',
  },
  toggleBtnActive: { backgroundColor: '#6B5CE720', borderColor: '#6B5CE7' },
  toggleText: { fontSize: 12, color: '#9A9AB8', fontWeight: '600' }, // WCAG AA対応: #666 → #9A9AB8
  toggleTextActive: { color: '#9C8FFF' },
  deleteBtn: { paddingVertical: 6, paddingLeft: 8 },
  deleteText: { color: '#9A9AB8', fontSize: 12, fontWeight: '600' }, // WCAG AA対応: #666 → #9A9AB8
  addForm: { padding: 16, flex: 1 },
  formLabel: { fontSize: 13, color: '#9A9AB8', marginBottom: 10, marginTop: 16 },
  labelInput: {
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  previewWrap: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#222238',
    borderWidth: 1,
    borderColor: '#33334D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: { fontSize: 12, color: '#9A9AB8' },
  addFormButtons: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2D2D44',
    alignItems: 'center',
  },
  cancelFormText: { color: '#9A9AB8', fontSize: 15 },
  saveFormBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6B5CE7',
    alignItems: 'center',
  },
  saveFormBtnDisabled: { opacity: 0.5 },
  saveFormText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  paywall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  paywallIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(107, 92, 231, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(107, 92, 231, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  paywallTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  paywallDesc: { fontSize: 15, color: '#B0B0C8', textAlign: 'center', lineHeight: 24, marginBottom: 16 },
  paywallCta: { fontSize: 13, color: '#9A9AB8' },
});
