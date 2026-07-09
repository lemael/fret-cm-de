import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { announcementsAPI } from '../services/api';

type Announcement = {
  id: string;
  title: string;
  body: string;
  author_role: 'ADMIN' | 'GESTIONNAIRE';
  created_at: string;
};

const AUTHOR_LABELS: Record<Announcement['author_role'], string> = {
  ADMIN: 'Administrateur',
  GESTIONNAIRE: 'Gestionnaire',
};

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await announcementsAPI.list();
      setAnnouncements(res.data);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnnouncements();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Champs manquants', 'Titre et texte sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      await announcementsAPI.create(title.trim(), body.trim());
      setTitle('');
      setBody('');
      setFormVisible(false);
      await fetchAnnouncements();
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer l'annonce");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Annonces</Text>
      <Text style={styles.subtitle}>Visibles par tous les clients sur leur tableau de bord.</Text>

      <TouchableOpacity style={styles.addButton} onPress={() => setFormVisible((v) => !v)}>
        <Text style={styles.addButtonText}>{formVisible ? 'Annuler' : 'Nouvelle annonce'}</Text>
      </TouchableOpacity>

      {formVisible ? (
        <View style={styles.formCard}>
          <Text style={styles.formLabel}>Titre</Text>
          <TextInput
            style={styles.formInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Nouveaux tarifs"
          />

          <Text style={styles.formLabel}>Texte</Text>
          <TextInput
            style={[styles.formInput, styles.textArea]}
            value={body}
            onChangeText={setBody}
            placeholder="Détails de l'annonce..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Publier</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Historique</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 20 }} />
      ) : announcements.length === 0 ? (
        <Text style={styles.emptyText}>Aucune annonce publiée.</Text>
      ) : (
        announcements.map((announcement) => (
          <View key={announcement.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>{announcement.title}</Text>
              <Text style={styles.cardAuthor}>{AUTHOR_LABELS[announcement.author_role]}</Text>
            </View>
            <Text style={styles.cardBody}>{announcement.body}</Text>
            <Text style={styles.cardDate}>{new Date(announcement.created_at).toLocaleString('fr-FR')}</Text>
          </View>
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
  addButton: {
    marginTop: 16,
    backgroundColor: '#17332c',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fffaf2',
    fontWeight: '800',
    fontSize: 14,
  },
  formCard: {
    marginTop: 14,
    backgroundColor: '#fffaf2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  textArea: { height: 100 },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#b75d4b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    color: '#17332c',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: '#17332c',
    fontWeight: '800',
    fontSize: 14,
  },
  cardAuthor: {
    color: '#8a8c86',
    fontSize: 11,
    fontWeight: '700',
  },
  cardBody: {
    marginTop: 8,
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
  cardDate: {
    marginTop: 8,
    color: '#8a8c86',
    fontSize: 11,
  },
});
