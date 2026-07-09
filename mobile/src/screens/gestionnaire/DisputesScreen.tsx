import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { disputesAPI } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Disputes'>;

export type Dispute = {
  id: string;
  shipment_id: string;
  type: 'LOST' | 'NON_CONFORME' | 'AUTRE';
  description: string | null;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  resolution: string | null;
  tracking_token: string;
  client_name: string | null;
  client_phone: string;
  created_at: string;
};

const STATUS_TABS: Dispute['status'][] = ['OPEN', 'IN_REVIEW', 'RESOLVED'];

const STATUS_LABELS: Record<Dispute['status'], string> = {
  OPEN: 'Ouverts',
  IN_REVIEW: 'En cours',
  RESOLVED: 'Résolus',
};

const TYPE_LABELS: Record<Dispute['type'], string> = {
  LOST: 'Colis perdu',
  NON_CONFORME: 'Colis non conforme',
  AUTRE: 'Autre',
};

export default function DisputesScreen() {
  const navigation = useNavigation<Nav>();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatus, setActiveStatus] = useState<Dispute['status']>('OPEN');

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await disputesAPI.list();
      setDisputes(res.data);
    } catch {
      setDisputes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDisputes();
  };

  const filtered = useMemo(
    () => disputes.filter((d) => d.status === activeStatus),
    [disputes, activeStatus]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Litiges</Text>

      <View style={styles.tabsRow}>
        {STATUS_TABS.map((status) => {
          const active = status === activeStatus;
          const count = disputes.filter((d) => d.status === status).length;
          return (
            <TouchableOpacity
              key={status}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveStatus(status)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {STATUS_LABELS[status]} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>Aucun litige dans cette catégorie.</Text>
      ) : (
        filtered.map((dispute) => (
          <TouchableOpacity
            key={dispute.id}
            style={styles.card}
            onPress={() => navigation.navigate('DisputeDetail', { disputeId: dispute.id, dispute })}
          >
            <View style={styles.cardTopRow}>
              <Text style={styles.cardType}>{TYPE_LABELS[dispute.type]}</Text>
              <Text style={styles.cardDate}>{new Date(dispute.created_at).toLocaleDateString('fr-FR')}</Text>
            </View>
            <Text style={styles.cardClient}>{dispute.client_name || dispute.client_phone}</Text>
            {dispute.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>{dispute.description}</Text>
            ) : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20 },
  title: {
    color: '#17332c',
    fontSize: 26,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#eadfce',
    backgroundColor: '#fffaf2',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: '#0f4c5c',
    borderColor: '#0f4c5c',
  },
  tabText: {
    color: '#17332c',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#fffaf2',
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardType: {
    color: '#17332c',
    fontWeight: '800',
    fontSize: 14,
  },
  cardDate: {
    color: '#8a8c86',
    fontSize: 12,
  },
  cardClient: {
    marginTop: 6,
    color: '#5f6a65',
    fontSize: 13,
  },
  cardDescription: {
    marginTop: 8,
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
});
