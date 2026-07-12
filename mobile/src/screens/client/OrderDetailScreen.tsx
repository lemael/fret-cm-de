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
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/AppNavigator';

type RouteType = RouteProp<RootStackParamList, 'OrderDetail'>;

type Message = {
  id: string;
  sender_role: 'CLIENT' | 'ADMIN' | 'GESTIONNAIRE';
  body: string;
  created_at: string;
};

const SIZE_CATEGORY_LABELS: Record<string, string> = {
  XL: 'XL',
  XXL: 'XXL',
  VOLUMETRIC_1M3: '1 m³',
  BULK_1000_1999: '1000 kg <= x <= 1999 kg',
  BULK_2000_2999: '2000 kg <= x <= 2999 kg',
  BULK_3000_PLUS: '3000 kg <= x',
};

const formatPrice = (price: number | null | undefined) =>
  price === null || price === undefined ? 'À définir' : `${price.toLocaleString('fr-FR')} €`;

// Le client ne doit jamais savoir si c'est l'admin ou le gestionnaire qui a
// répondu — seul le personnel voit la distinction entre les deux rôles.
const getAuthorLabel = (senderRole: Message['sender_role'], viewerRole: string) => {
  if (senderRole === viewerRole.toUpperCase()) return 'Vous';
  if (senderRole === 'CLIENT') return 'Client';
  if (viewerRole === 'client') return 'Support';
  return senderRole === 'ADMIN' ? 'Administrateur' : 'Gestionnaire';
};

export default function OrderDetailScreen() {
  const route = useRoute<RouteType>();
  const { role } = useAuth();
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
            <Text style={styles.cardTitle}>Détails de la commande</Text>

            <Text style={styles.fieldLabel}>Produits</Text>
            {(order.content_description || '')
              .split('\n')
              .filter((name: string) => name.trim())
              .map((name: string, index: number) => (
                <Text key={index} style={styles.orderInfo}>
                  • {name}
                </Text>
              ))}
            {!order.content_description ? (
              <Text style={styles.orderInfo}>Aucun produit renseigné.</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Poids</Text>
            <Text style={styles.orderInfo}>
              {order.weight_kg ? `${order.weight_kg} kg` : 'Non renseigné'}
            </Text>

            <Text style={styles.fieldLabel}>Taille du colis</Text>
            <Text style={styles.orderInfo}>
              {SIZE_CATEGORY_LABELS[order.size_category] || 'Non renseignée'}
            </Text>

            <Text style={styles.fieldLabel}>Prix</Text>
            <Text style={styles.orderInfo}>{formatPrice(order.price_eur)}</Text>

            <Text style={styles.fieldLabel}>Adresse d'enlèvement</Text>
            <Text style={styles.orderInfo}>{order.pickup_address || 'Non renseignée'}</Text>

            <Text style={styles.fieldLabel}>Adresse de livraison</Text>
            <Text style={styles.orderInfo}>{order.delivery_address || 'Non renseignée'}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Messages (rendez-vous, réclamations)</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 20 }} />
        ) : messages.length === 0 ? (
          <Text style={styles.emptyText}>Aucun message pour ce dossier.</Text>
        ) : (
          messages.map((message) => {
            const isOwnMessage = role && message.sender_role === role.toUpperCase();
            return (
              <View
                key={message.id}
                style={[styles.bubble, isOwnMessage ? styles.bubbleOwn : styles.bubbleOther]}
              >
                <Text style={[styles.bubbleAuthor, isOwnMessage && styles.bubbleTextOwn]}>
                  {getAuthorLabel(message.sender_role, role || 'client')}
                </Text>
                <Text style={[styles.bubbleText, isOwnMessage && styles.bubbleTextOwn]}>
                  {message.body}
                </Text>
                <Text style={[styles.bubbleDate, isOwnMessage && styles.bubbleTextOwn]}>
                  {new Date(message.created_at).toLocaleString('fr-FR')}
                </Text>
              </View>
            );
          })
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
  cardTitle: {
    color: '#17332c',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  fieldLabel: {
    marginTop: 12,
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  orderInfo: {
    color: '#5f6a65',
    fontSize: 13,
    marginTop: 4,
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
  bubbleOwn: {
    backgroundColor: '#b75d4b',
    alignSelf: 'flex-end',
  },
  bubbleOther: {
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
  bubbleTextOwn: {
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
