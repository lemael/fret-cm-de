import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { shipmentsAPI } from '../services/api';

const CATEGORY_LABELS: Record<string, string> = {
  ARRIVAL: "📦 Suivi d'arrivée",
  CLAIM: '⚠️ Réclamation',
  SHIPMENT: '🚢 Nouvel envoi',
  SCHEDULE: '📅 Prochains départs',
  CUSTOMS: '🛃 Produits & douane',
  UNKNOWN: '❓ Non classé',
};

type Result = {
  category: string;
  statusLink: string;
  clientName: string | null;
};

export default function ParseMessageScreen() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const handleParse = async () => {
    if (!phone.trim() || !message.trim()) {
      Alert.alert('Champs manquants', 'Le numéro et le message sont obligatoires');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await shipmentsAPI.parse(
        phone.trim(),
        message.trim(),
        name.trim() || undefined
      );
      setResult({
        category: res.data.shipment.category,
        statusLink: res.data.statusLink,
        clientName: res.data.client.name,
      });
    } catch {
      Alert.alert('Erreur', "Impossible d'analyser le message");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.statusLink);
    Alert.alert('Copié !', 'Collez ce lien dans WhatsApp');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Numéro WhatsApp *</Text>
      <TextInput
        style={styles.input}
        placeholder="+237 6XX XXX XXX"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Nom du client (optionnel)</Text>
      <TextInput
        style={styles.input}
        placeholder="Jean Dupont"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Message WhatsApp *</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Collez le message du client ici..."
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleParse}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Analyser le message</Text>
        )}
      </TouchableOpacity>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultCategory}>
            {CATEGORY_LABELS[result.category]}
          </Text>
          <Text style={styles.resultLink} numberOfLines={1}>
            {result.statusLink}
          </Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
            <Text style={styles.copyButtonText}>
              Copier le lien à envoyer au client
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: { height: 130 },
  button: {
    backgroundColor: '#1a56db',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#1a56db',
  },
  resultCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  resultLink: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  copyButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  copyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
