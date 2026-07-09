import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios from 'axios';
import { authAPI } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone.trim() || !name.trim() || !newPassword || !confirmNewPassword) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Mot de passe trop court', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await authAPI.clientForgotPassword(phone.trim(), name.trim(), newPassword);
      Alert.alert(
        'Mot de passe modifié',
        'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: unknown) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : 'Numéro de téléphone ou nom incorrect';
      Alert.alert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.subtitle}>
          Renseignez votre numéro de téléphone et votre nom tels qu'enregistrés lors de votre inscription.
        </Text>

        <Text style={styles.label}>Numéro de téléphone</Text>
        <TextInput
          style={styles.input}
          placeholder="+237 6XX XXX XXX"
          placeholderTextColor="#94a3b8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Nom</Text>
        <TextInput
          style={styles.input}
          placeholder="Votre nom"
          placeholderTextColor="#94a3b8"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Nouveau mot de passe</Text>
        <PasswordInput
          style={styles.input}
          placeholder="Nouveau mot de passe"
          placeholderTextColor="#94a3b8"
          value={newPassword}
          onChangeText={setNewPassword}
        />

        <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
        <PasswordInput
          style={styles.input}
          placeholder="Confirmer le mot de passe"
          placeholderTextColor="#94a3b8"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Réinitialiser le mot de passe</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 14,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#1a56db',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
