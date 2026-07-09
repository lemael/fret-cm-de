import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { clientsAPI, shipmentsAPI, disputesAPI } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type RouteType = RouteProp<RootStackParamList, 'ClientDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientDetail'>;

const DISPUTE_TYPES: { label: string; value: 'LOST' | 'NON_CONFORME' | 'AUTRE' }[] = [
  { label: 'Colis perdu', value: 'LOST' },
  { label: 'Colis non conforme', value: 'NON_CONFORME' },
  { label: 'Autre', value: 'AUTRE' },
];

const CATEGORY_LABELS: Record<string, string> = {
  ARRIVAL: 'Suivi arrivée',
  CLAIM: 'Réclamation',
  SHIPMENT: 'Envoi',
  SCHEDULE: 'Calendrier',
  CUSTOMS: 'Douane',
  UNKNOWN: 'Non classé',
};

const STATUS_OPTIONS = [
  'EN_ATTENTE',
  'EN_ENTREPOT_FRANCFORT',
  'EN_MER',
  'DOUANE_DOUALA',
  'PRET_RECUPERATION',
  'LIVRE',
  'PROBLEME',
];

export default function ClientDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteType>();
  const { clientId } = route.params;
  const [data, setData] = useState<{ client: any; shipments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const res = await clientsAPI.detail(clientId);
    setData(res.data);
  };

  useEffect(() => {
    clientsAPI.detail(clientId).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  }, [clientId]);

  const changeStatus = (shipmentId: string) => {
    Alert.alert(
      'Changer le statut',
      'Sélectionnez un statut',
      [
        ...STATUS_OPTIONS.map((s) => ({
          text: s.replace(/_/g, ' '),
          onPress: async () => {
            await shipmentsAPI.updateStatus(shipmentId, s);
            await refresh();
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const reportDispute = (shipmentId: string) => {
    Alert.alert(
      'Signaler un litige',
      'Type de litige',
      [
        ...DISPUTE_TYPES.map(({ label, value }) => ({
          text: label,
          onPress: async () => {
            try {
              await disputesAPI.create(shipmentId, value);
              Alert.alert('Litige signalé', 'Le gestionnaire pourra le traiter.');
            } catch {
              Alert.alert('Erreur', 'Impossible de signaler le litige');
            }
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  if (loading) {
    return (
      <ActivityIndicator
        size="large"
        color="#1a56db"
        style={{ marginTop: 60 }}
      />
    );
  }
  if (!data) return null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{data.client.name || 'Client inconnu'}</Text>
        <Text style={styles.phone}>{data.client.phone}</Text>
      </View>

      <Text style={styles.sectionTitle}>
        Dossiers ({data.shipments.length})
      </Text>

      {data.shipments.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.category}>{CATEGORY_LABELS[s.category]}</Text>
            <TouchableOpacity onPress={() => changeStatus(s.id)}>
              <Text style={styles.statusBadge}>
                {s.status.replace(/_/g, ' ')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.rawMsg} numberOfLines={3}>
            {s.raw_message}
          </Text>
          <Text style={styles.date}>
            {new Date(s.created_at).toLocaleDateString('fr-FR')}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('OrderDetail', { shipmentId: s.id, order: s })}
            >
              <Text style={styles.actionButtonText}>Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonWarning]}
              onPress={() => reportDispute(s.id)}
            >
              <Text style={styles.actionButtonText}>Signaler un litige</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { backgroundColor: '#1a56db', padding: 24 },
  name: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  phone: { color: '#bfdbfe', fontSize: 16, marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    margin: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: { fontSize: 15, fontWeight: '600', color: '#111827' },
  statusBadge: {
    backgroundColor: '#dbeafe',
    color: '#1a56db',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  rawMsg: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  date: { fontSize: 12, color: '#9ca3af' },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  actionButtonWarning: {
    backgroundColor: '#b91c1c',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
