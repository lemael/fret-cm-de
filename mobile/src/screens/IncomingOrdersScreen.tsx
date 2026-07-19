import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { shipmentsAPI } from '../services/api';

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
      { text: 'Confirmer', onPress: onConfirm },
    ]);
  }
};

type Order = {
  id: string;
  status: string;
  tracking_token: string;
  content_description: string | null;
  created_at: string;
  client_name: string | null;
  client_phone: string;
  price_eur: number | null;
  weight_kg: string | number | null;
  size_category: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
};

const formatPrice = (price: number | null) =>
  price === null ? 'À définir' : `${price.toLocaleString('fr-FR')} €`;

const SIZE_CATEGORY_LABELS: Record<string, string> = {
  XL: 'XL',
  XXL: 'XXL',
  VOLUMETRIC_1M3: '1 m³',
  BULK_1000_1999: '1000 kg <= x <= 1999 kg',
  BULK_2000_2999: '2000 kg <= x <= 2999 kg',
  BULK_3000_PLUS: '3000 kg <= x',
};

const STATUS_LABELS: Record<string, string> = {
  COLIS_NON_RECU: 'Colis pas encore reçu',
  COLIS_RECU: 'Souhait du client',
  COLIS_REJETE: 'Colis rejeté',
  COLIS_PRET_ENVOI_CM: "Colis prêt à l'envoi au Cameroun",
};

const parseProductNames = (description: string | null) => {
  if (!description) return [];
  return description
    .split('\n')
    .map((line) => line.replace(/^\s*\d+(\.\d+)?\s*x\s*/i, '').trim())
    .filter(Boolean);
};

export default function IncomingOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await shipmentsAPI.clientOrders();
      setOrders(res.data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const handleTransferToGestionnaire = async () => {
    setClosing(true);
    try {
      const res = await shipmentsAPI.closeBatch();
      notify(
        'Envoi transféré',
        `${res.data.packagesCount} colis transférés au gestionnaire.`
      );
      await fetchOrders();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Impossible de transférer la liste';
      notify('Erreur', message);
    } finally {
      setClosing(false);
    }
  };

  const confirmTransfer = () => {
    confirm(
      'Transférer au gestionnaire',
      'Est-ce que la liste des commandes est déjà complète ?',
      handleTransferToGestionnaire
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Réception des commandes</Text>
      <Text style={styles.subtitle}>Commandes soumises directement par les clients.</Text>

      <TouchableOpacity
        style={[styles.closeBatchButton, closing && styles.buttonDisabled]}
        onPress={confirmTransfer}
        disabled={closing}
      >
        {closing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.closeBatchButtonText}>Transférer au gestionnaire</Text>
        )}
      </TouchableOpacity>

      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.colName]}>Client</Text>
          <Text style={[styles.headerCell, styles.colNumber]}>N° commande</Text>
          <Text style={[styles.headerCell, styles.colStatus]}>Statut</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
        ) : orders.length === 0 ? (
          <Text style={styles.emptyText}>Aucune commande client pour le moment.</Text>
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.row}
              onPress={() => setSelectedOrder(order)}
            >
              <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
                {order.client_name || order.client_phone}
              </Text>
              <Text style={[styles.cell, styles.colNumber]} numberOfLines={1}>
                {order.tracking_token.slice(0, 8)}
              </Text>
              <View style={styles.colStatus}>
                <Text style={styles.statusBadge} numberOfLines={2}>
                  {STATUS_LABELS[order.status] || order.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedOrder?.client_name || selectedOrder?.client_phone}
            </Text>
            <Text style={styles.modalSubtitle}>
              N° commande : {selectedOrder?.tracking_token.slice(0, 8)}
            </Text>

            <Text style={styles.modalFieldLabel}>Poids</Text>
            <Text style={styles.modalFieldValue}>
              {selectedOrder?.weight_kg ? `${selectedOrder.weight_kg} kg` : 'Non renseigné'}
            </Text>

            <Text style={styles.modalFieldLabel}>Taille du colis</Text>
            <Text style={styles.modalFieldValue}>
              {(selectedOrder?.size_category && SIZE_CATEGORY_LABELS[selectedOrder.size_category]) ||
                'Non renseignée'}
            </Text>

            <Text style={styles.modalFieldLabel}>Prix</Text>
            <Text style={styles.modalFieldValue}>{formatPrice(selectedOrder?.price_eur ?? null)}</Text>

            <Text style={styles.modalSectionTitle}>Produits</Text>
            {parseProductNames(selectedOrder?.content_description ?? null).length === 0 ? (
              <Text style={styles.emptyText}>Aucun produit renseigné.</Text>
            ) : (
              parseProductNames(selectedOrder?.content_description ?? null).map((name, index) => (
                <Text key={index} style={styles.productItem}>
                  • {name}
                </Text>
              ))
            )}

            <Text style={styles.modalFieldLabel}>Adresse d'enlèvement</Text>
            <Text style={styles.modalFieldValue}>{selectedOrder?.pickup_address || 'Non renseignée'}</Text>

            <Text style={styles.modalFieldLabel}>Adresse de livraison</Text>
            <Text style={styles.modalFieldValue}>{selectedOrder?.delivery_address || 'Non renseignée'}</Text>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setSelectedOrder(null)}
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
  closeBatchButton: {
    marginTop: 16,
    backgroundColor: '#b75d4b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBatchButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: { opacity: 0.7 },
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
  colName: { flex: 1.6, paddingRight: 6 },
  colNumber: { flex: 1, paddingRight: 6, fontFamily: 'monospace' },
  colStatus: { flex: 1.6 },
  statusBadge: {
    color: '#17332c',
    backgroundColor: '#ece4d7',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
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
  },
  modalTitle: {
    color: '#17332c',
    fontSize: 19,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
    fontFamily: 'monospace',
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
  modalSectionTitle: {
    marginTop: 18,
    marginBottom: 8,
    color: '#17332c',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  productItem: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 6,
  },
  closeModalButton: {
    marginTop: 20,
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
