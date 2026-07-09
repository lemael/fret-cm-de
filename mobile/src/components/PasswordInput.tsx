import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = TextInputProps & { style?: StyleProp<ViewStyle> };

// Champ mot de passe avec bouton oeil pour afficher/masquer la saisie.
// Le style passe sur le conteneur (fond, bordure, padding, marge) afin de
// reproduire visuellement un TextInput classique sans changer les appelants.
export default function PasswordInput({ style, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        {...props}
        style={styles.input}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.eyeButton}
        onPress={() => setVisible((v) => !v)}
        accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  eyeButton: {
    paddingLeft: 10,
  },
});
