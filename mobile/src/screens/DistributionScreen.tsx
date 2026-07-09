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
import { useAuth } from '../context/AuthContext';

type Parcel = {
  id: string;
  status: string;
  tracking_token: string;
  content_description: string | null;
  updated_at: string;
  client_name: string | null;
  client_phone: string;
};

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "Colis prêt à l'envoi au Cameroun", value: 'COLIS_PRET_ENVOI_CM' },
  { label: 'Colis existant', value: 'COLIS_EXISTANT' },
  { label: 'Colis bien envoyé', value: 'COLIS_BIEN_ENVOYE' },
  { label: 'Colis introuvable', value: 'COLIS_INTROUVABLE' },
];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map(({ label, value }) => [value, label])
);

export default function DistributionScreen() {
  const { role } = useAuth();
  const canEdit = role === 'gestionnaire';
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchParcels = useCallback(async () => {
    try {
      const res = await shipmentsAPI.distributionList();
      setParcels(res.data);
    } catch {
      setParcels([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchParcels();
  };

  const changeStatus = (parcel: Parcel) => {
    if (!canEdit) return;
    Alert.alert(
      'Changer le statut',
      parcel.client_name || parcel.client_phone,
      [
        ...STATUS_OPTIONS.map(({ label, value }) => ({
          text: label,
          onPress: async () => {
            await shipmentsAPI.updateDistributionStatus(parcel.id, value);
            await fetchParcels();
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
      <Text style={styles.title}>Distribution des colis</Text>
      <Text style={styles.subtitle}>
        {canEdit
          ? 'Colis arrivés après transport — faites-les progresser jusqu\'à la remise au client.'
          : 'Suivi en lecture seule, mis à jour par le gestionnaire.'}
      </Text>

      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.colName]}>Client</Text>
          <Text style={[styles.headerCell, styles.colNumber]}>N° commande</Text>
          <Text style={[styles.headerCell, styles.colStatus]}>Statut</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
        ) : parcels.length === 0 ? (
          <Text style={styles.emptyText}>Aucun colis en distribution pour le moment.</Text>
        ) : (
          parcels.map((parcel) => (
            <View key={parcel.id} style={styles.row}>
              <Text style={[styles.cell, styles.colName]} numberOfLines={1}>
                {parcel.client_name || parcel.client_phone}
              </Text>
              <Text style={[styles.cell, styles.colNumber]} numberOfLines={1}>
                {parcel.tracking_token.slice(0, 8)}
              </Text>
              <TouchableOpacity
                style={styles.colStatus}
                onPress={() => changeStatus(parcel)}
                disabled={!canEdit}
              >
                <Text style={styles.statusBadge} numberOfLines={2}>
                  {STATUS_LABELS[parcel.status] || parcel.status}
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
    lineHeight: 18,
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
    backgroundColor: '#0f4c5c',
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
