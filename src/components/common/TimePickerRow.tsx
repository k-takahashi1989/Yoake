import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';

interface Props {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}

export default function TimePickerRow({ label, value, onChange }: Props) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => setShow(true)} style={styles.timeButton}>
        <Text style={styles.timeText}>{format(value, 'HH:mm')}</Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={value}
          mode="time"
          is24Hour
          display="spinner"
          onChange={(_, date) => {
            setShow(false);
            if (date) onChange(date);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  timeButton: {
    backgroundColor: '#1A1A2E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6B5CE7',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B5CE7',
  },
});
