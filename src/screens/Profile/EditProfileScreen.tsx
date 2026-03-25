import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../i18n';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const { profile, updateProfile } = useAuthStore();
  const { t } = useTranslation();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [height, setHeight] = useState(
    profile?.height != null ? String(profile.height) : '',
  );
  const [weight, setWeight] = useState(
    profile?.weight != null ? String(profile.weight) : '',
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const h = height ? parseFloat(height) : null;
    const w = weight ? parseFloat(weight) : null;

    if (h !== null && (isNaN(h) || h < 50 || h > 250)) {
      Alert.alert(t('editProfile.inputError'), t('editProfile.heightError'));
      return;
    }
    if (w !== null && (isNaN(w) || w < 20 || w > 300)) {
      Alert.alert(t('editProfile.inputError'), t('editProfile.weightError'));
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        displayName: name.trim() || null,
        height: h,
        weight: w,
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
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

            <FieldLabel>{t('editProfile.height')}</FieldLabel>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={setHeight}
              placeholder={t('editProfile.heightPlaceholder')}
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              maxLength={5}
            />

            <FieldLabel>{t('editProfile.weight')}</FieldLabel>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder={t('editProfile.weightPlaceholder')}
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              maxLength={5}
            />
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
  label: { fontSize: 12, color: '#888', marginBottom: 6, marginTop: 12 },
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
});
