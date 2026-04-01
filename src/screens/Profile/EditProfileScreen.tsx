import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList, AgeGroup } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuthStore();
  const { t } = useTranslation();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(profile?.ageGroup ?? null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        displayName: name.trim() || null,
        ageGroup,
      });
      navigation.goBack();
    } catch {
      Alert.alert(t('editProfile.inputError'), t('editProfile.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <FieldLabel>{t('editProfile.nickname')}</FieldLabel>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('editProfile.nicknamePlaceholder')}
              placeholderTextColor="#555"
              maxLength={20}
            />

            <FieldLabel>{t('editProfile.ageGroup')}</FieldLabel>
            <View style={styles.ageGroupRow}>
              {(['teens', '20s_30s', '40s_50s', '60plus'] as AgeGroup[]).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.ageBtn, ageGroup === g && styles.ageBtnActive]}
                  onPress={() => setAgeGroup(ageGroup === g ? null : g)}
                >
                  <Text style={[styles.ageBtnText, ageGroup === g && styles.ageBtnTextActive]}>
                    {t(`editProfile.ageGroup_${g}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.saveBtnText}>{t('editProfile.saveBtn')}</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A2E' },
  scroll: { flex: 1 },
  card: {
    margin: 16,
    backgroundColor: '#2D2D44',
    borderRadius: 16,
    padding: 16,
  },
  label: { fontSize: 12, color: '#9A9AB8', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3D3D5E',
  },
  saveBtn: {
    marginHorizontal: 16,
    backgroundColor: '#6B5CE7',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  ageGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  ageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#3D3D5E',
  },
  ageBtnActive: {
    backgroundColor: '#6B5CE7',
    borderColor: '#6B5CE7',
  },
  ageBtnText: { color: '#9A9AB8', fontSize: 14 },
  ageBtnTextActive: { color: '#FFFFFF', fontWeight: '600' },
});
