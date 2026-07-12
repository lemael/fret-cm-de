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
  weight_kg: string | number | null;
  size_category: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  price_eur: number | null;
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

const SIZE_CATEGORY_LABELS: Record<string, string> = {
  XL: 'XL',
  XXL: 'XXL',
  VOLUMETRIC_1M3: '1 m³',
  BULK_1000_1999: '1000 kg <= x <= 1999 kg',
  BULK_2000_2999: '2000 kg <= x <= 2999 kg',
  BULK_3000_PLUS: '3000 kg <= x',
};

const formatPrice = (price: number | null) =>
  price === null ? 'À définir' : `${price.toLocaleString('fr-FR')} €`;

const parseProductNames = (description: string | null) => {
  if (!description) return [];
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

export default function DistributionScreen() {
  const { role } = useAuth();
  const canEdit = role === 'gestionnaire';
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);

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
      <Text style={styles.title}>{canEdit ? 'Chargement des colis' : 'Arrivée des colis'}</Text>
      <Text style={styles.subtitle}>
        {canEdit
          ? 'Commandes transférées par l\'administrateur — faites-les progresser jusqu\'à la remise au client.'
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
            <TouchableOpacity
              key={parcel.id}
              style={styles.row}
              onPress={() => setSelectedParcel(parcel)}
            >
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
            </TouchableOpacity>
          ))
        )}
      </View>

      <Modal
        visible={!!selectedParcel}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedParcel(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedParcel?.client_name || selectedParcel?.client_phone}
            </Text>
            <Text style={styles.modalSubtitle}>
              N° commande : {selectedParcel?.tracking_token.slice(0, 8)}
            </Text>

            <Text style={styles.modalFieldLabel}>Poids</Text>
            <Text style={styles.modalFieldValue}>
              {selectedParcel?.weight_kg ? `${selectedParcel.weight_kg} kg` : 'Non renseigné'}
            </Text>

            <Text style={styles.modalFieldLabel}>Taille du colis</Text>
            <Text style={styles.modalFieldValue}>
              {(selectedParcel?.size_category && SIZE_CATEGORY_LABELS[selectedParcel.size_category]) ||
                'Non renseignée'}
            </Text>

            <Text style={styles.modalFieldLabel}>Prix</Text>
            <Text style={styles.modalFieldValue}>{formatPrice(selectedParcel?.price_eur ?? null)}</Text>

            <Text style={styles.modalSectionTitle}>Produits</Text>
            {parseProductNames(selectedParcel?.content_description ?? null).length === 0 ? (
              <Text style={styles.emptyText}>Aucun produit renseigné.</Text>
            ) : (
              parseProductNames(selectedParcel?.content_description ?? null).map((name, index) => (
                <Text key={index} style={styles.productItem}>
                  • {name}
                </Text>
              ))
            )}

            <Text style={styles.modalFieldLabel}>Adresse d'enlèvement</Text>
            <Text style={styles.modalFieldValue}>{selectedParcel?.pickup_address || 'Non renseignée'}</Text>

            <Text style={styles.modalFieldLabel}>Adresse de livraison</Text>
            <Text style={styles.modalFieldValue}>{selectedParcel?.delivery_address || 'Non renseignée'}</Text>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setSelectedParcel(null)}
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
