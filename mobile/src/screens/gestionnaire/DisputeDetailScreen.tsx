import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { disputesAPI } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DisputeDetail'>;
type RouteType = RouteProp<RootStackParamList, 'DisputeDetail'>;

const TYPE_LABELS: Record<string, string> = {
  LOST: 'Colis perdu',
  NON_CONFORME: 'Colis non conforme',
  AUTRE: 'Autre',
};

export default function DisputeDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const { dispute } = route.params;
  const [status, setStatus] = useState(dispute.status);
  const [resolution, setResolution] = useState(dispute.resolution || '');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (newStatus: typeof status) => {
    setSaving(true);
    try {
      await disputesAPI.update(dispute.id, { status: newStatus, resolution: resolution.trim() || undefined });
      setStatus(newStatus);
      if (newStatus === 'RESOLVED') {
        Alert.alert('Litige résolu', 'Le litige a été marqué comme résolu.', [
          { text: 'OK', onPress: () => navigation.navigate('Disputes') },
        ]);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour le litige');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.type}>{TYPE_LABELS[dispute.type] || dispute.type}</Text>
        <Text style={styles.client}>{dispute.client_name || dispute.client_phone}</Text>
        <Text style={styles.token}>Dossier: {dispute.tracking_token}</Text>
        {dispute.description ? <Text style={styles.description}>{dispute.description}</Text> : null}
      </View>

      <Text style={styles.label}>Statut actuel: {status}</Text>
      <View style={styles.statusRow}>
        {(['OPEN', 'IN_REVIEW', 'RESOLVED'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusButton, status === s && styles.statusButtonActive]}
            onPress={() => handleUpdate(s)}
            disabled={saving}
          >
            <Text style={[styles.statusButtonText, status === s && styles.statusButtonTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Résolution</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Décrire la résolution apportée..."
        value={resolution}
        onChangeText={setResolution}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.buttonDisabled]}
        onPress={() => handleUpdate(status)}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20 },
  card: {
    backgroundColor: '#fffaf2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 16,
    marginBottom: 20,
  },
  type: {
    color: '#17332c',
    fontSize: 17,
    fontWeight: '800',
  },
  client: {
    marginTop: 6,
    color: '#5f6a65',
    fontSize: 14,
  },
  token: {
    marginTop: 4,
    color: '#8a8c86',
    fontSize: 12,
  },
  description: {
    marginTop: 10,
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eadfce',
    backgroundColor: '#fffaf2',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#0f4c5c',
    borderColor: '#0f4c5c',
  },
  statusButtonText: {
    color: '#17332c',
    fontSize: 11,
    fontWeight: '700',
  },
  statusButtonTextActive: {
    color: '#fffaf2',
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 110,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#b75d4b',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
