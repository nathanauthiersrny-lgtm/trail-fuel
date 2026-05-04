import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { DateTimePickerField } from '../DateTimePickerField';
import type { RaceCreationDraft } from '../../services/race-creation-store';

type Props = {
  draft: RaceCreationDraft;
  updateDraft: (patch: Partial<RaceCreationDraft>) => void;
};

export function Step1({ draft, updateDraft }: Props) {
  return (
    <View>
      <Text style={styles.heading}>Identification</Text>

      <Text style={styles.label}>Nom de la sortie (optionnel)</Text>
      <TextInput
        style={styles.input}
        value={draft.name}
        onChangeText={(v) => updateDraft({ name: v })}
        placeholder="ex. Sortie du dimanche, UTMB 2025…"
        returnKeyType="done"
      />
      <Text style={styles.hint}>Laissé vide → nom auto-généré à la création.</Text>

      <DateTimePickerField
        label="Date et heure de départ prévue"
        value={draft.scheduled_start_at}
        onChange={(ts) => updateDraft({ scheduled_start_at: ts })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#111' },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
    color: '#111',
    marginBottom: 4,
  },
  hint: { fontSize: 12, color: '#999', marginBottom: 20 },
});
