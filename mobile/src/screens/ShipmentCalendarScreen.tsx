import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { shipmentScheduleAPI, ShipmentScheduleEntry } from '../services/api';

// Alert.alert() ne fait rien sur Expo web (react-native-web ne l'implémente pas).
const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const confirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const daysUntil = (value: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function ShipmentCalendarScreen() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [entries, setEntries] = useState<ShipmentScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipmentDate, setShipmentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await shipmentScheduleAPI.list();
      setEntries(res.data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEntries();
  };

  const handleAdd = async () => {
    if (!shipmentDate.trim() || Number.isNaN(Date.parse(shipmentDate.trim()))) {
      notify('Date invalide', 'Entrez une date au format AAAA-MM-JJ (ex: 2026-08-15).');
      return;
    }
    setSubmitting(true);
    try {
      await shipmentScheduleAPI.create(shipmentDate.trim(), notes.trim() || undefined);
      setShipmentDate('');
      setNotes('');
      await fetchEntries();
    } catch {
      notify('Erreur', "Impossible d'ajouter cette date d'envoi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (entry: ShipmentScheduleEntry) => {
    confirm('Supprimer cette date', formatDate(entry.shipment_date), async () => {
      try {
        await shipmentScheduleAPI.remove(entry.id);
        await fetchEntries();
      } catch {
        notify('Erreur', 'Impossible de supprimer cette date');
      }
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Calendrier des envois</Text>
      <Text style={styles.subtitle}>
        Dates prévues d'envoi des colis du Cameroun vers l'Allemagne.
        {isAdmin ? '' : ' Consultation seule — géré par l\'admin.'}
      </Text>

      {isAdmin ? (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Date d'envoi (AAAA-MM-JJ)</Text>
          <TextInput
            style={styles.formInput}
            value={shipmentDate}
            onChangeText={setShipmentDate}
            placeholder="2026-08-15"
          />
          <Text style={styles.formLabel}>Notes (optionnel)</Text>
          <TextInput
            style={styles.formInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: conteneur n°3"
          />
          <TouchableOpacity
            style={[styles.addButton, submitting && styles.buttonDisabled]}
            onPress={handleAdd}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Ajouter au calendrier</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.emptyText}>Aucune date d'envoi programmée pour le moment.</Text>
      ) : (
        entries.map((entry) => {
          const remaining = daysUntil(entry.shipment_date);
          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardDate}>{formatDate(entry.shipment_date)}</Text>
                {isAdmin ? (
                  <TouchableOpacity onPress={() => handleDelete(entry)}>
                    <Text style={styles.deleteText}>Supprimer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.cardCountdown}>
                {remaining > 0
                  ? `Dans ${remaining} jour${remaining > 1 ? 's' : ''}`
                  : remaining === 0
                  ? "Aujourd'hui"
                  : 'Passé'}
              </Text>
              {entry.notes ? <Text style={styles.cardNotes}>{entry.notes}</Text> : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    color: '#17332c',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    marginTop: 18,
    backgroundColor: '#fffaf2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addButton: {
    marginTop: 16,
    backgroundColor: '#b75d4b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyText: {
    marginTop: 20,
    color: '#6e7069',
    fontSize: 14,
  },
  card: {
    marginTop: 14,
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 16,
    padding: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardDate: {
    flex: 1,
    color: '#17332c',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  deleteText: {
    color: '#b75d4b',
    fontSize: 12,
    fontWeight: '700',
  },
  cardCountdown: {
    marginTop: 6,
    color: '#0f4c5c',
    fontSize: 12,
    fontWeight: '700',
  },
  cardNotes: {
    marginTop: 6,
    color: '#5f6a65',
    fontSize: 13,
  },
});
