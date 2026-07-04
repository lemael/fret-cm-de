import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { authAPI } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen() {
  const navigation = useNavigation<Nav>();
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = async () => {
    setErrorMessage(null);

    if (!username.trim() || !newPassword || !confirmPassword) {
      setErrorMessage('Veuillez remplir tous les champs.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(username.trim(), newPassword);
      setIsSuccess(true);
    } catch (error: unknown) {
      const statusCode = axios.isAxiosError(error) ? error.response?.status : undefined;
      const backendMessage =
        axios.isAxiosError(error) && typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : null;

      if (statusCode === 403 || backendMessage === 'Username admin invalide') {
        setErrorMessage('Username admin incorrect.');
      } else {
        setErrorMessage(backendMessage ?? 'Impossible de modifier le mot de passe.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>Mot de passe modifié avec succès</Text>
          <Text style={styles.successText}>
            Le mot de passe admin a été mis à jour. Vous pouvez maintenant vous connecter avec le nouveau mot de passe.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.buttonText}>Retourner à la page de connexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modifier le mot de passe</Text>
      <Text style={styles.subtitle}>
        Cette action est autorisée uniquement avec le username de l'admin.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Username admin"
        placeholderTextColor="#94a3b8"
        value={username}
        onChangeText={(value) => {
          setUsername(value);
          if (errorMessage) setErrorMessage(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Nouveau mot de passe"
        placeholderTextColor="#94a3b8"
        value={newPassword}
        onChangeText={(value) => {
          setNewPassword(value);
          if (errorMessage) setErrorMessage(null);
        }}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        placeholderTextColor="#94a3b8"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          if (errorMessage) setErrorMessage(null);
        }}
        secureTextEntry
      />

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Valider</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 20,
  },
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
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 10,
  },
  successText: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '500',
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
