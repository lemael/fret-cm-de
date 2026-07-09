import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth, Role } from '../context/AuthContext';
import { authAPI } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

// Un seul formulaire sert les 3 profils (client, gestionnaire, admin).
// On essaie chaque connexion dans l'ordre jusqu'a ce qu'une reussisse.
async function tryLogin(identifier: string, password: string): Promise<{ token: string; role: Role } | null> {
  try {
    const res = await authAPI.clientLogin(identifier, password);
    return { token: res.data.token, role: 'client' };
  } catch {
    // pas un client, on essaie la suite
  }

  try {
    const res = await authAPI.gestionnaireLogin(identifier, password);
    return { token: res.data.token, role: 'gestionnaire' };
  } catch {
    // pas un gestionnaire, on essaie la suite
  }

  try {
    const res = await authAPI.login(identifier, password);
    return { token: res.data.token, role: 'admin' };
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      const result = await tryLogin(identifier.trim(), password);
      if (!result) {
        Alert.alert('Connexion échouée', 'Identifiants incorrects');
        return;
      }
      await login(result.token, result.role);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Fret CM-DE</Text>
      <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

      <TextInput
        style={styles.input}
        placeholder="Téléphone ou identifiant"
        placeholderTextColor="#94a3b8"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <PasswordInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor="#94a3b8"
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.link}
        onPress={() => navigation.navigate('ClientRegister')}
      >
        <Text style={styles.linkText}>Vous n'avez pas de compte ?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.link}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        <Text style={styles.linkText}>Mot de passe oublié ?</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a56db',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#bfdbfe',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 48,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  link: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#dbeafe',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
});
