import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { clientsAPI } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type Client = {
  id: string;
  phone: string;
  name: string | null;
  created_at: string;
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const res = await clientsAPI.list();
      setClients(res.data);
    } catch {
      // L'utilisateur pourra rafraîchir manuellement
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

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ParseMessage', {})}
      >
        <Text style={styles.fabText}>+ Analyser un nouveau message</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Aucun client enregistré</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('ClientDetail', { clientId: item.id })
              }
            >
              <Text style={styles.cardName}>{item.name || 'Client inconnu'}</Text>
              <Text style={styles.cardPhone}>{item.phone}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Déconnexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  fab: {
    backgroundColor: '#1a56db',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardPhone: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 60,
    fontSize: 16,
  },
  logoutBtn: { padding: 16, alignItems: 'center' },
  logoutText: { color: '#6b7280', fontSize: 14 },
});
