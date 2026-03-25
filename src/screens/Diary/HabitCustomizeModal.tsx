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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHabitStore } from '../../stores/habitStore';
import { useAuthStore } from '../../stores/authStore';
import { HabitTemplate } from '../../types';
import { FREE_LIMITS } from '../../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'list' | 'add';

const PRESET_EMOJIS = ['🧘', '📚', '🎵', '🌿', '💊', '🚫', '🍵', '🥗', '💻', '🌙', '🏋️', '🧹'];

export default function HabitCustomizeModal({ visible, onClose }: Props) {
  const { templates, addHabit, toggleActive, removeHabit } = useHabitStore();
  const { isPremium } = useAuthStore();
  const [mode, setMode] = useState<Mode>('list');
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('🧘');
  const [isSaving, setIsSaving] = useState(false);

  const customTemplates = templates.filter(t => !t.isDefault);
  const canAddMore = customTemplates.length < FREE_LIMITS.MAX_HABIT_ITEMS;

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      Alert.alert('入力エラー', '習慣名を入力してください。');
      return;
    }
    if (!canAddMore) {
      Alert.alert('上限に達しました', `カスタム習慣は${FREE_LIMITS.MAX_HABIT_ITEMS}個まで追加できます。`);
      return;
    }
    setIsSaving(true);
    try {
      await addHabit(trimmed, newEmoji);
      setNewLabel('');
      setNewEmoji('🧘');
      setMode('list');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (template: HabitTemplate) => {
    Alert.alert(
      '習慣を削除',
      `「${template.label}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => removeHabit(template.id),
        },
      ],
    );
  };

  const renderPaywall = () => (
    <View style={styles.paywall}>
      <Text style={styles.paywallIcon}>⚙️</Text>
      <Text style={styles.paywallTitle}>習慣カスタマイズ</Text>
      <Text style={styles.paywallDesc}>
        オリジナルの習慣を追加して{'\n'}より詳しく睡眠への影響を分析できます。
      </Text>
      <Text style={styles.paywallCta}>プレミアムプランで利用できます</Text>
    </View>
  );

  const renderHabitRow = ({ item }: { item: HabitTemplate }) => (
    <View style={styles.habitRow}>
      <Text style={styles.habitEmoji}>{item.emoji}</Text>
      <View style={styles.habitInfo}>
        <Text style={styles.habitLabel}>{item.label}</Text>
        {item.isDefault && <Text style={styles.habitDefault}>デフォルト</Text>}
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
          <Text style={styles.deleteText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>閉じる</Text>
          </TouchableOpacity>
          <Text style={styles.title}>習慣カスタマイズ</Text>
          {isPremium && mode === 'list' ? (
            <TouchableOpacity onPress={() => setMode('add')} style={styles.addBtn}>
              <Text style={styles.addText}>＋ 追加</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {!isPremium ? (
          renderPaywall()
        ) : mode === 'add' ? (
          <View style={styles.addForm}>
            <Text style={styles.formLabel}>絵文字を選択</Text>
            <View style={styles.emojiGrid}>
              {PRESET_EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiChip, newEmoji === e && styles.emojiChipSelected]}
                  onPress={() => setNewEmoji(e)}
                >
                  <Text style={styles.emojiChipText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.formLabel}>習慣名</Text>
            <TextInput
              style={styles.labelInput}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="例: 瞑想した"
              placeholderTextColor="#555"
              maxLength={20}
              autoFocus
            />
            <View style={styles.addFormButtons}>
              <TouchableOpacity
                style={styles.cancelFormBtn}
                onPress={() => { setMode('list'); setNewLabel(''); }}
              >
                <Text style={styles.cancelFormText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveFormBtn, isSaving && styles.saveFormBtnDisabled]}
                onPress={handleAdd}
                disabled={isSaving}
              >
                {isSaving
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.saveFormText}>追加する</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              習慣のON/OFFで記録時の表示を切り替えられます。
              {'\n'}カスタム習慣はあと{FREE_LIMITS.MAX_HABIT_ITEMS - customTemplates.length}個追加できます。
            </Text>
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
  closeText: { color: '#888', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  addBtn: { paddingHorizontal: 8, paddingVertical: 4, minWidth: 60, alignItems: 'flex-end' },
  addText: { color: '#6B5CE7', fontSize: 15, fontWeight: '600' },
  hint: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 12, color: '#666', lineHeight: 18 },
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
  habitEmoji: { fontSize: 22, width: 30 },
  habitInfo: { flex: 1 },
  habitLabel: { fontSize: 15, color: '#FFFFFF' },
  habitDefault: { fontSize: 10, color: '#666', marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#2D2D44',
    borderWidth: 1,
    borderColor: '#444',
  },
  toggleBtnActive: { backgroundColor: '#6B5CE720', borderColor: '#6B5CE7' },
  toggleText: { fontSize: 12, color: '#666', fontWeight: '600' },
  toggleTextActive: { color: '#9C8FFF' },
  deleteBtn: { padding: 8 },
  deleteText: { color: '#666', fontSize: 14 },
  // 追加フォーム
  addForm: { padding: 16, flex: 1 },
  formLabel: { fontSize: 13, color: '#888', marginBottom: 10, marginTop: 16 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#2D2D44',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiChipSelected: { borderColor: '#6B5CE7' },
  emojiChipText: { fontSize: 22 },
  labelInput: {
    backgroundColor: '#2D2D44',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
  },
  addFormButtons: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelFormBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2D2D44',
    alignItems: 'center',
  },
  cancelFormText: { color: '#888', fontSize: 15 },
  saveFormBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#6B5CE7',
    alignItems: 'center',
  },
  saveFormBtnDisabled: { opacity: 0.5 },
  saveFormText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  // ペイウォール
  paywall: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  paywallIcon: { fontSize: 56, marginBottom: 16 },
  paywallTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  paywallDesc: { fontSize: 15, color: '#B0B0C8', textAlign: 'center', lineHeight: 24, marginBottom: 16 },
  paywallCta: { fontSize: 13, color: '#888' },
});
