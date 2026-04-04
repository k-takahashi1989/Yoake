import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScalePressable from './ScalePressable';

interface ScaleOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: ScaleOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function SubjectiveScaleInput<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const displayOptions = [...options].reverse();
  const selectedIndex = displayOptions.findIndex(option => option.value === value);

  return (
    <View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>{displayOptions[0]?.label ?? ''}</Text>
        <Text style={styles.legendText}>{displayOptions[displayOptions.length - 1]?.label ?? ''}</Text>
      </View>

      <View style={styles.scaleRow}>
        {displayOptions.map((option, index) => {
          const isActive = option.value === value;

          return (
            <ScalePressable
              key={option.value}
              style={[styles.scaleButton, isActive && styles.scaleButtonActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.scaleNumber, isActive && styles.scaleNumberActive]}>
                {index + 1}
              </Text>
            </ScalePressable>
          );
        })}
      </View>

      <Text style={styles.selectedLabel}>
        {selectedIndex >= 0 ? displayOptions[selectedIndex].label : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  legendText: {
    flex: 1,
    fontSize: 11,
    color: '#8F8CAF',
  },
  scaleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scaleButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#444',
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonActive: {
    backgroundColor: '#6B5CE720',
    borderColor: '#6B5CE7',
  },
  scaleNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C2C0D8',
  },
  scaleNumberActive: {
    color: '#F6F3FF',
  },
  selectedLabel: {
    marginTop: 10,
    fontSize: 12,
    color: '#A8A4C7',
    textAlign: 'center',
    minHeight: 18,
  },
});
