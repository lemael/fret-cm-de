import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { announcementsAPI, AnnouncementDetail } from '../services/api';

// Alert.alert() ne fait rien sur Expo web (react-native-web ne l'implémente pas).
const notify = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

type Route = RouteProp<RootStackParamList, 'AnnouncementDetail'>;

const AUTHOR_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
  CLIENT: 'Client',
};

const STATUS_LABELS: Record<string, string> = {
  COLIS_RECU: 'Souhait du client',
  COLIS_NON_RECU: 'Colis pas encore reçu',
  COLIS_REJETE: 'Colis rejeté',
  COLIS_PRET_ENVOI_CM: "Colis prêt à l'envoi au Cameroun",
  COLIS_EXISTANT: 'Colis existant',
  COLIS_BIEN_ENVOYE: 'Colis bien envoyé',
  COLIS_INTROUVABLE: 'Colis introuvable',
};

const parseProductNames = (description: string | null) => {
  if (!description) return [];
  return description.split('\n').map((line) => line.trim()).filter(Boolean);
};

const formatPrice = (price: number | null) =>
  price === null || price === undefined ? 'À définir' : `${price.toLocaleString('fr-FR')} €`;

export default function AnnouncementDetailScreen() {
  const route = useRoute<Route>();
  const { announcementId } = route.params;

  const [detail, setDetail] = useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await announcementsAPI.detail(announcementId);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [announcementId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDetail();
  };

  const handleSendComment = async () => {
    const body = comment.trim();
    if (!body) return;
    setSending(true);
    try {
      await announcementsAPI.addComment(announcementId, body);
      setComment('');
      await fetchDetail();
    } catch {
      notify('Erreur', "Impossible d'envoyer le commentaire");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f4c5c" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Impossible de charger cette annonce.</Text>
      </View>
    );
  }

  const { announcement, shipment, comments } = detail;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.author}>{AUTHOR_LABELS[announcement.author_role]}</Text>
        </View>
        <Text style={styles.body}>{announcement.body}</Text>
        <Text style={styles.date}>{new Date(announcement.created_at).toLocaleString('fr-FR')}</Text>
      </View>

      {shipment ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Détails de la commande</Text>
          <Text style={styles.fieldLabel}>N° commande</Text>
          <Text style={styles.fieldValue}>{shipment.tracking_token.slice(0, 8)}</Text>

          <Text style={styles.fieldLabel}>Client</Text>
          <Text style={styles.fieldValue}>{shipment.client_name || shipment.client_phone}</Text>

          <Text style={styles.fieldLabel}>Statut</Text>
          <Text style={styles.fieldValue}>{STATUS_LABELS[shipment.status] || shipment.status}</Text>

          <Text style={styles.fieldLabel}>Poids</Text>
          <Text style={styles.fieldValue}>{shipment.weight_kg ? `${shipment.weight_kg} kg` : 'Non renseigné'}</Text>

          <Text style={styles.fieldLabel}>Prix</Text>
          <Text style={styles.fieldValue}>{formatPrice(shipment.price_eur)}</Text>

          <Text style={styles.fieldLabel}>Adresse d'enlèvement</Text>
          <Text style={styles.fieldValue}>{shipment.pickup_address || 'Non renseignée'}</Text>

          <Text style={styles.fieldLabel}>Adresse de livraison</Text>
          <Text style={styles.fieldValue}>{shipment.delivery_address || 'Non renseignée'}</Text>

          <Text style={styles.sectionSubtitle}>Produits</Text>
          {parseProductNames(shipment.content_description).length === 0 ? (
            <Text style={styles.emptyProductsText}>Aucun produit renseigné.</Text>
          ) : (
            parseProductNames(shipment.content_description).map((name, index) => (
              <Text key={index} style={styles.productItem}>
                • {name}
              </Text>
            ))
          )}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Commentaires</Text>
        {comments.length === 0 ? (
          <Text style={styles.emptyText}>Aucun commentaire pour le moment.</Text>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={styles.commentCard}>
              <View style={styles.commentTopRow}>
                <Text style={styles.commentAuthor}>{AUTHOR_LABELS[c.author_role] || c.author_role}</Text>
                <Text style={styles.commentDate}>{new Date(c.created_at).toLocaleString('fr-FR')}</Text>
              </View>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          ))
        )}

        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder="Ajouter un commentaire..."
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!comment.trim() || sending) && styles.buttonDisabled]}
          onPress={handleSendComment}
          disabled={!comment.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Envoyer</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f1e8' },
  card: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    flex: 1,
    color: '#17332c',
    fontSize: 19,
    fontWeight: '800',
  },
  author: {
    color: '#8a8c86',
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    marginTop: 10,
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  date: {
    marginTop: 10,
    color: '#8a8c86',
    fontSize: 11,
  },
  sectionTitle: {
    color: '#17332c',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionSubtitle: {
    marginTop: 14,
    marginBottom: 8,
    color: '#17332c',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  fieldLabel: {
    marginTop: 10,
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fieldValue: {
    marginTop: 2,
    color: '#17332c',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyProductsText: {
    color: '#6e7069',
    fontSize: 13,
  },
  productItem: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 6,
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
  },
  commentCard: {
    backgroundColor: '#f6f1e8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  commentTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  commentAuthor: {
    color: '#17332c',
    fontSize: 12,
    fontWeight: '800',
  },
  commentDate: {
    color: '#8a8c86',
    fontSize: 11,
  },
  commentBody: {
    marginTop: 6,
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
  commentInput: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sendButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#0f4c5c',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  buttonDisabled: { opacity: 0.7 },
  sendButtonText: {
    color: '#fffaf2',
    fontSize: 13,
    fontWeight: '800',
  },
});
