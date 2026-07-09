import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { messagesAPI } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';

type RouteType = RouteProp<RootStackParamList, 'OrderDetail'>;

type Message = {
  id: string;
  sender_role: 'CLIENT' | 'ADMIN';
  body: string;
  created_at: string;
};

export default function OrderDetailScreen() {
  const route = useRoute<RouteType>();
  const { shipmentId, order } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await messagesAPI.list(shipmentId);
      setMessages(res.data);
    } catch {
      // On garde le fil déjà affiché si le rafraîchissement échoue.
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await messagesAPI.send(shipmentId, text.trim());
      setText('');
      await fetchMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {order ? (
          <View style={styles.orderCard}>
            <Text style={styles.orderContent}>{order.content_description || 'Commande'}</Text>
            <Text style={styles.orderInfo}>Poids: {order.weight_kg ? `${order.weight_kg} kg` : 'Non renseigné'}</Text>
            <Text style={styles.orderInfo}>
              {order.pickup_address} → {order.delivery_address}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Messages (rendez-vous, réclamations)</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 20 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyText}>Aucun message pour ce dossier.</Text>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubble,
                message.sender_role === 'CLIENT' ? styles.bubbleClient : styles.bubbleAdmin,
              ]}
            >
              <Text style={[styles.bubbleAuthor, message.sender_role === 'CLIENT' && styles.bubbleTextClient]}>
                {message.sender_role === 'CLIENT' ? 'Vous' : 'Administrateur'}
              </Text>
              <Text style={[styles.bubbleText, message.sender_role === 'CLIENT' && styles.bubbleTextClient]}>
                {message.body}
              </Text>
              <Text style={[styles.bubbleDate, message.sender_role === 'CLIENT' && styles.bubbleTextClient]}>
                {new Date(message.created_at).toLocaleString('fr-FR')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Écrire un message..."
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={styles.sendButtonText}>Envoyer</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 8 },
  orderCard: {
    backgroundColor: '#fffaf2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eadfce',
    marginBottom: 16,
  },
  orderContent: {
    color: '#17332c',
    fontSize: 16,
    fontWeight: '800',
  },
  orderInfo: {
    color: '#5f6a65',
    fontSize: 13,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  bubbleClient: {
    backgroundColor: '#b75d4b',
    alignSelf: 'flex-end',
  },
  bubbleAdmin: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    alignSelf: 'flex-start',
  },
  bubbleAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: '#1f2937',
  },
  bubbleDate: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 6,
  },
  bubbleTextClient: {
    color: '#fffaf2',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    backgroundColor: '#fffaf2',
    borderTopWidth: 1,
    borderTopColor: '#eadfce',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#17332c',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  sendButtonText: {
    color: '#fffaf2',
    fontWeight: '700',
    fontSize: 13,
  },
});
