import React, { useCallback, useEffect, useState } from 'react';
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
import { messagesAPI } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MessagesInbox'>;

type Conversation = {
  shipment_id: string;
  tracking_token: string;
  client_id: string;
  client_name: string | null;
  client_phone: string;
  last_message_body: string;
  last_message_sender_role: 'CLIENT' | 'ADMIN' | 'GESTIONNAIRE';
  last_message_at: string;
};

const SENDER_LABELS: Record<Conversation['last_message_sender_role'], string> = {
  CLIENT: 'Client',
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
};

export default function MessagesInboxScreen() {
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await messagesAPI.inbox();
      setConversations(res.data);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInbox();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Conversations partagées avec l'administrateur.</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
      ) : conversations.length === 0 ? (
        <Text style={styles.emptyText}>Aucune conversation pour le moment.</Text>
      ) : (
        conversations.map((conversation) => (
          <TouchableOpacity
            key={conversation.shipment_id}
            style={styles.card}
            onPress={() =>
              navigation.navigate('OrderDetail', { shipmentId: conversation.shipment_id })
            }
          >
            <View style={styles.cardTopRow}>
              <Text style={styles.cardClient}>
                {conversation.client_name || conversation.client_phone}
              </Text>
              <Text style={styles.cardDate}>
                {new Date(conversation.last_message_at).toLocaleDateString('fr-FR')}
              </Text>
            </View>
            <Text style={styles.cardPreview} numberOfLines={2}>
              {SENDER_LABELS[conversation.last_message_sender_role]}: {conversation.last_message_body}
            </Text>
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
  subtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
  },
  emptyText: {
    marginTop: 20,
    color: '#6e7069',
    fontSize: 14,
  },
  card: {
    marginTop: 14,
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 18,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardClient: {
    color: '#17332c',
    fontWeight: '800',
    fontSize: 14,
  },
  cardDate: {
    color: '#8a8c86',
    fontSize: 12,
  },
  cardPreview: {
    marginTop: 8,
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
});
