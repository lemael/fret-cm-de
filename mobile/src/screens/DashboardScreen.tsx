import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { shipmentsAPI } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';
import NotificationBell from '../components/NotificationBell';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

type Batch = {
  id: string;
  shipped_at: string;
  received_at: string | null;
  packages_count: string | number;
};

const formatDate = (value: string | null) => {
  if (!value) return 'En attente';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await shipmentsAPI.batches();
      setBatches(res.data);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBatches();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Pilotage operationnel</Text>
            <Text style={styles.heroTitle}>Fret CM-DE</Text>
          </View>
          <View style={styles.heroActions}>
            <NotificationBell />
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Deconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.navLinksRow}>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('IncomingOrders')}>
            <Text style={styles.navLinkText}>Réception des commandes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('Distribution')}>
            <Text style={styles.navLinkText}>Arrivée des colis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('Announcements')}>
            <Text style={styles.navLinkText}>Voir les annonces</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Historique des derniers envois</Text>
        <Text style={styles.sectionSubtitle}>
          Chaque clôture de la liste de colis complet crée un nouvel envoi ici.
        </Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerCell, styles.colCount]}>Colis</Text>
            <Text style={[styles.headerCell, styles.colDate]}>Envoyé le</Text>
            <Text style={[styles.headerCell, styles.colDate]}>Reçu au Cameroun</Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
          ) : batches.length === 0 ? (
            <Text style={styles.emptyText}>Aucun envoi clôturé pour le moment.</Text>
          ) : (
            batches.map((batch) => (
              <View key={batch.id} style={styles.row}>
                <Text style={[styles.cell, styles.colCount]}>{batch.packages_count}</Text>
                <Text style={[styles.cell, styles.colDate]}>{formatDate(batch.shipped_at)}</Text>
                <Text style={[styles.cell, styles.colDate]}>{formatDate(batch.received_at)}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f1e8',
  },
  contentContainer: {
    paddingBottom: 24,
  },
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
    alignItems: 'flex-start',
    gap: 12,
  },
  heroEyebrow: {
    color: '#d6e4dd',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fffaf2',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    marginTop: 8,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  navLinksRow: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  navLink: {
    alignSelf: 'flex-start',
  },
  navLinkText: {
    color: '#d2e0da',
    textDecorationLine: 'underline',
    fontSize: 13,
    fontWeight: '700',
  },
  panel: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#17332c',
    fontSize: 21,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
  },
  table: {
    marginTop: 16,
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
  colCount: { flex: 0.8 },
  colDate: { flex: 1.4 },
  emptyText: {
    padding: 16,
    color: '#6e7069',
    fontSize: 14,
  },
});
