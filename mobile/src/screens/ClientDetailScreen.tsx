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
import { useRoute, RouteProp } from '@react-navigation/native';
import { clientsAPI, shipmentsAPI } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type RouteType = RouteProp<RootStackParamList, 'ClientDetail'>;

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
});
