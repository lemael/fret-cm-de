import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ClientHome'>;

type Order = {
  id: string;
  status: string;
  category: string;
  content_description: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  EN_ATTENTE_CHARGEMENT: 'En attente chargement',
  PRET_A_PARTIR: 'Prêt à partir',
  EN_MER: 'En mer',
  TRACKING_EN_COURS: 'Tracking en cours',
  EN_DISTRIBUTION: 'En distribution',
  DISTRIBUE: 'Distribué',
  LIVRE: 'Livré',
};

const formatStatus = (status: string) => STATUS_LABELS[status] || status.replaceAll('_', ' ');

export default function ClientHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await ordersAPI.mine();
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTitle}>Mes commandes</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('CreateOrder')}
        >
          <Text style={styles.primaryActionText}>Nouvelle commande</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucune commande pour le moment</Text>
          <Text style={styles.emptyText}>Créez votre première commande pour l'envoyer à l'équipe.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.card}
              onPress={() => navigation.navigate('OrderDetail', { shipmentId: order.id, order })}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardContent}>{order.content_description || 'Commande'}</Text>
                <Text style={styles.cardStatus}>{formatStatus(order.status)}</Text>
              </View>
              {order.pickup_address || order.delivery_address ? (
                <Text style={styles.cardAddress}>
                  {order.pickup_address} → {order.delivery_address}
                </Text>
              ) : null}
              <Text style={styles.cardDate}>
                {new Date(order.created_at).toLocaleDateString('fr-FR')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { paddingBottom: 24 },
  hero: {
    backgroundColor: '#17332c',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    color: '#fffaf2',
    fontSize: 26,
    fontWeight: '800',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 250, 242, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 250, 242, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#fffaf2',
    fontWeight: '700',
    fontSize: 13,
  },
  primaryAction: {
    marginTop: 18,
    backgroundColor: '#b75d4b',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyCard: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#fffaf2',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#17332c',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  list: {
    marginTop: 18,
    paddingHorizontal: 20,
    gap: 10,
  },
  card: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 20,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardContent: {
    flex: 1,
    color: '#17332c',
    fontSize: 15,
    fontWeight: '800',
  },
  cardStatus: {
    color: '#17332c',
    backgroundColor: '#ece4d7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  cardAddress: {
    marginTop: 10,
    color: '#5f6a65',
    fontSize: 13,
  },
  cardDate: {
    marginTop: 10,
    color: '#8a8c86',
    fontSize: 12,
  },
});
