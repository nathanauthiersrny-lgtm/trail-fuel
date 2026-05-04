import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  label: string;
  value: number; // epoch ms UTC
  onChange: (epochMs: number) => void;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatEpoch(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePickerField({ label, value, onChange }: Props) {
  // Android requires two sequential modals: date then time.
  const [show, setShow] = useState<'none' | 'date' | 'time'>('none');
  const [pendingDate, setPendingDate] = useState<Date>(new Date(value));

  function handleDateChange(_event: DateTimePickerEvent, selected?: Date) {
    if (_event.type === 'dismissed') {
      setShow('none');
      return;
    }
    if (!selected) return;
    setPendingDate(selected);
    setShow('time');
  }

  function handleTimeChange(_event: DateTimePickerEvent, selected?: Date) {
    if (_event.type === 'dismissed') {
      setShow('none');
      return;
    }
    if (!selected) return;
    // Combine the date from pendingDate with the hours/minutes from selected.
    const combined = new Date(pendingDate);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(combined.getTime());
    setShow('none');
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setShow('date')}
        activeOpacity={0.7}
      >
        <Text style={styles.value}>{formatEpoch(value)}</Text>
        <Text style={styles.icon}>📅</Text>
      </TouchableOpacity>

      {show === 'date' && (
        <DateTimePicker
          mode="date"
          value={new Date(value)}
          display="default"
          onChange={handleDateChange}
        />
      )}
      {show === 'time' && (
        <DateTimePicker
          mode="time"
          value={pendingDate}
          display="default"
          onChange={handleTimeChange}
          is24Hour
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  value: { fontSize: 15, color: '#111' },
  icon: { fontSize: 16 },
});
