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
import { Picker } from '@react-native-picker/picker';
import { shipmentsAPI } from '../services/api';

const CLIENT_WEB_BASE_URL = 'https://ravishing-endurance-production-7ff1.up.railway.app';

const normalizeStatusLink = (link: string): string => {
  try {
    const parsed = new URL(link);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const token = parts[parts.length - 1];
    if (!token) return link;
    return `${CLIENT_WEB_BASE_URL}/status/${token}`;
  } catch {
    return link;
  }
};

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
  parcel: {
    clientName: string | null;
    clientPhone: string | null;
    products: string[];
    dimensions: { length: number; width: number; height: number; unit: string } | null;
  } | null;
  parcelMissingFields: string[];
  parcelReadyToDepart: boolean;
};

export default function ParseMessageScreen() {
  const [subject, setSubject] = useState<'SEND_PACKAGE' | 'OTHER'>('OTHER');
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
        name.trim() || undefined,
        subject
      );
      setResult({
        category: res.data.shipment.category,
        statusLink: normalizeStatusLink(res.data.statusLink),
        clientName: res.data.client.name,
        parcel: res.data.parcel,
        parcelMissingFields: res.data.parcelMissingFields || [],
        parcelReadyToDepart: Boolean(res.data.parcelReadyToDepart),
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
      <Text style={styles.label}>Subject *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={subject}
          onValueChange={(value) => setSubject(value as 'SEND_PACKAGE' | 'OTHER')}
          style={styles.picker}
        >
          <Picker.Item label="Autres" value="OTHER" />
          <Picker.Item label="Envoyer un colis" value="SEND_PACKAGE" />
        </Picker>
      </View>

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

          {subject === 'SEND_PACKAGE' && result.parcel ? (
            <View style={styles.parcelCard}>
              <Text style={styles.parcelTitle}>Objet colis cree automatiquement</Text>
              <Text style={styles.parcelText}>Client: {result.parcel.clientName || 'Manquant'}</Text>
              <Text style={styles.parcelText}>Telephone: {result.parcel.clientPhone || 'Manquant'}</Text>
              <Text style={styles.parcelText}>
                Produits: {result.parcel.products.length ? result.parcel.products.join(', ') : 'Manquant'}
              </Text>
              <Text style={styles.parcelText}>
                Dimensions:{' '}
                {result.parcel.dimensions
                  ? `${result.parcel.dimensions.length} x ${result.parcel.dimensions.width} x ${result.parcel.dimensions.height} ${result.parcel.dimensions.unit}`
                  : 'Manquant'}
              </Text>

              <View
                style={[
                  styles.routingBadge,
                  result.parcelReadyToDepart ? styles.routingBadgeReady : styles.routingBadgePending,
                ]}
              >
                <Text style={styles.routingBadgeText}>
                  {result.parcelReadyToDepart
                    ? 'Place dans: Chargement > Colis pret a partir'
                    : 'Place dans: Chargement > Colis en attente (pas prets)'}
                </Text>
              </View>

              {result.parcelMissingFields.length ? (
                <Text style={styles.missingText}>
                  Champs manquants: {result.parcelMissingFields.join(', ')}
                </Text>
              ) : null}
            </View>
          ) : null}
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
  pickerWrap: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  picker: {
    height: 54,
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
  parcelCard: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 6,
  },
  parcelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  parcelText: {
    fontSize: 13,
    color: '#374151',
  },
  routingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  routingBadgeReady: {
    backgroundColor: '#d1fae5',
  },
  routingBadgePending: {
    backgroundColor: '#fee2e2',
  },
  routingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
  },
  missingText: {
    marginTop: 6,
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
});
