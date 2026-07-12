import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { clientsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

type SubscribedClient = {
  id: string;
  name: string | null;
  first_name: string | null;
  phone: string;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  is_subscribed: boolean;
};

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

export default function SubscribedClientsScreen() {
  const { role } = useAuth();
  const canEdit = role === 'admin';
  const [clients, setClients] = useState<SubscribedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClient, setSelectedClient] = useState<SubscribedClient | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const res = await clientsAPI.subscribers();
      setClients(res.data);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClients();
  };

  const toggleSubscription = async () => {
    if (!selectedClient) return;
    const nextValue = !selectedClient.is_subscribed;
    setUpdating(true);
    try {
      const res = await clientsAPI.updateSubscription(selectedClient.id, nextValue);
      setClients((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? { ...c, is_subscribed: res.data.is_subscribed } : c))
      );
      setSelectedClient((prev) => (prev ? { ...prev, is_subscribed: res.data.is_subscribed } : prev));
      notify(
        'Statut mis à jour',
        res.data.is_subscribed ? 'Le client est maintenant abonné.' : "Le client n'est plus abonné."
      );
    } catch {
      notify('Erreur', 'Impossible de modifier le statut du client');
    } finally {
      setUpdating(false);
    }
  };

  const deleteAccount = async () => {
    if (!selectedClient) return;
    setDeleting(true);
    try {
      await clientsAPI.remove(selectedClient.id);
      setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
      setSelectedClient(null);
      notify('Compte supprimé', "Le client n'a plus accès à l'application.");
    } catch {
      notify('Erreur', 'Impossible de supprimer ce compte');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (!selectedClient) return;
    confirm(
      'Supprimer ce compte',
      `${selectedClient.name || selectedClient.phone} n'aura plus accès à l'application et ses commandes seront définitivement supprimées. Continuer ?`,
      deleteAccount
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Clients abonnés</Text>
      <Text style={styles.subtitle}>
        Statut d'abonnement de chaque client (60 € — obligatoire avant de soumettre une commande).
      </Text>

      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.colName]}>Nom</Text>
          <Text style={[styles.headerCell, styles.colName]}>Prénom</Text>
          <Text style={[styles.headerCell, styles.colPhone]}>Téléphone</Text>
          <Text style={[styles.headerCell, styles.colStatus]}>Statut</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
        ) : clients.length === 0 ? (
          <Text style={styles.emptyText}>Aucun client pour le moment.</Text>
        ) : (
          clients.map((client) => (
            <TouchableOpacity
              key={client.id}
              style={styles.row}
              onPress={() => setSelectedClient(client)}
            >
              <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
                {client.name || '—'}
              </Text>
              <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
                {client.first_name || '—'}
              </Text>
              <Text style={[styles.cell, styles.colPhone]} numberOfLines={1}>
                {client.phone}
              </Text>
              <View style={styles.colStatus}>
                <Text
                  style={[
                    styles.statusBadge,
                    client.is_subscribed ? styles.statusSubscribed : styles.statusNotSubscribed,
                  ]}
                >
                  {client.is_subscribed ? 'Abonné' : 'Non abonné'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Modal
        visible={!!selectedClient}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedClient(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedClient?.name || selectedClient?.first_name || selectedClient?.phone}
            </Text>

            <Text style={styles.modalFieldLabel}>Nom</Text>
            <Text style={styles.modalFieldValue}>{selectedClient?.name || 'Non renseigné'}</Text>

            <Text style={styles.modalFieldLabel}>Prénom</Text>
            <Text style={styles.modalFieldValue}>{selectedClient?.first_name || 'Non renseigné'}</Text>

            <Text style={styles.modalFieldLabel}>Téléphone</Text>
            <Text style={styles.modalFieldValue}>{selectedClient?.phone}</Text>

            <Text style={styles.modalFieldLabel}>Straße</Text>
            <Text style={styles.modalFieldValue}>{selectedClient?.street || 'Non renseignée'}</Text>

            <Text style={styles.modalFieldLabel}>PLZ</Text>
            <Text style={styles.modalFieldValue}>{selectedClient?.postal_code || 'Non renseigné'}</Text>

            <Text style={styles.modalFieldLabel}>Stadt</Text>
            <Text style={styles.modalFieldValue}>{selectedClient?.city || 'Non renseignée'}</Text>

            <Text style={styles.modalFieldLabel}>Statut</Text>
            <Text
              style={[
                styles.statusBadge,
                styles.modalStatusBadge,
                selectedClient?.is_subscribed ? styles.statusSubscribed : styles.statusNotSubscribed,
              ]}
            >
              {selectedClient?.is_subscribed ? 'Abonné' : 'Non abonné'}
            </Text>

            {canEdit ? (
              <TouchableOpacity
                style={[styles.toggleButton, updating && styles.buttonDisabled]}
                onPress={toggleSubscription}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.toggleButtonText}>
                    {selectedClient?.is_subscribed ? 'Marquer comme non abonné' : 'Marquer comme abonné'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {canEdit ? (
              <TouchableOpacity
                style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Supprimer le compte</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setSelectedClient(null)}
            >
              <Text style={styles.closeModalButtonText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20 },
  title: {
    color: '#17332c',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
  },
  table: {
    marginTop: 18,
    backgroundColor: '#fffaf2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eadfce',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#17332c',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  headerCell: {
    color: '#fffaf2',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#eadfce',
  },
  cell: {
    color: '#374151',
    fontSize: 13,
  },
  colName: { flex: 1.2, paddingRight: 6 },
  colPhone: { flex: 1.3, paddingRight: 6 },
  colStatus: { flex: 1 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  statusSubscribed: {
    color: '#166534',
    backgroundColor: '#dcfce7',
  },
  statusNotSubscribed: {
    color: '#991b1b',
    backgroundColor: '#fee2e2',
  },
  emptyText: {
    padding: 16,
    color: '#6e7069',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 51, 44, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fffaf2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  modalTitle: {
    color: '#17332c',
    fontSize: 19,
    fontWeight: '800',
  },
  modalFieldLabel: {
    marginTop: 12,
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalFieldValue: {
    marginTop: 2,
    color: '#17332c',
    fontSize: 14,
    fontWeight: '600',
  },
  modalStatusBadge: {
    marginTop: 6,
  },
  toggleButton: {
    marginTop: 20,
    backgroundColor: '#b75d4b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: { opacity: 0.7 },
  deleteButton: {
    marginTop: 10,
    backgroundColor: '#991b1b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  closeModalButton: {
    marginTop: 12,
    backgroundColor: '#17332c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
});
