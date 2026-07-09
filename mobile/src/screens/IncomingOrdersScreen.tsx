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
} from 'react-native';
import { shipmentsAPI } from '../services/api';

type Order = {
  id: string;
  status: string;
  tracking_token: string;
  content_description: string | null;
  created_at: string;
  client_name: string | null;
  client_phone: string;
};

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'Colis pas encore reçu', value: 'COLIS_NON_RECU' },
  { label: 'Colis bien reçu', value: 'COLIS_RECU' },
  { label: 'Colis rejeté', value: 'COLIS_REJETE' },
  { label: "Colis prêt à l'envoi au Cameroun", value: 'COLIS_PRET_ENVOI_CM' },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(({ label, value }) => [value, label])
);

export default function IncomingOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState(false);

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

  const handleCloseBatch = async () => {
    setClosing(true);
    try {
      const res = await shipmentsAPI.closeBatch();
      Alert.alert(
        'Envoi clôturé',
        `${res.data.packagesCount} colis clôturés pour l'envoi au Cameroun.`
      );
      await fetchOrders();
    } catch (err: any) {
      const message = err?.response?.data?.error || "Impossible de clôturer l'envoi";
      Alert.alert('Erreur', message);
    } finally {
      setClosing(false);
    }
  };

  const changeStatus = (order: Order) => {
    Alert.alert(
      'Changer le statut',
      order.client_name || order.client_phone,
      [
        ...STATUS_OPTIONS.map(({ label, value }) => ({
          text: label,
          onPress: async () => {
            await shipmentsAPI.updateStatus(order.id, value);
            await fetchOrders();
          },
        })),
        { text: 'Annuler', style: 'cancel' as const },
      ]
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
        onPress={handleCloseBatch}
        disabled={closing}
      >
        {closing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.closeBatchButtonText}>Liste de colis complet</Text>
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
            <View key={order.id} style={styles.row}>
              <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
                {order.client_name || order.client_phone}
              </Text>
              <Text style={[styles.cell, styles.colNumber]} numberOfLines={1}>
                {order.tracking_token.slice(0, 8)}
              </Text>
              <TouchableOpacity style={styles.colStatus} onPress={() => changeStatus(order)}>
                <Text style={styles.statusBadge} numberOfLines={2}>
                  {STATUS_LABELS[order.status] || order.status}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
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
});
