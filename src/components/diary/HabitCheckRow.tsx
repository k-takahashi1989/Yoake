import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { HabitEntry } from '../../types';
import { useTranslation } from '../../i18n';

interface Props {
  habit: HabitEntry;
  onToggle: () => void;
}

function getHabitDisplayLabel(habit: { id: string; label: string }, t: (key: string, opts?: any) => string): string {
  if (habit.id.startsWith('default_')) {
    return t(`habits.${habit.id}`, { defaultValue: habit.label });
  }
  return habit.label;
}

export default function HabitCheckRow({ habit, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.emoji}>{habit.emoji}</Text>
      <Text style={styles.label}>{getHabitDisplayLabel(habit, t)}</Text>
      <View style={[styles.checkbox, habit.checked && styles.checkboxChecked]}>
        {habit.checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D55',
  },
  emoji: {
    fontSize: 20,
    marginRight: 10,
    width: 28,
  },
  label: {
    flex: 1,
    fontSize: 15,
    color: '#E0E0F0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6B5CE7',
    borderColor: '#6B5CE7',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
