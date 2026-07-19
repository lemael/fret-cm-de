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
  Alert,
  Platform,
} from 'react-native';
import { shipmentsAPI } from '../../services/api';

// Alert.alert() ne fait rien sur Expo web (react-native-web ne l'implémente pas).
const notify = (title: string, message: string, onDismiss?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onDismiss?.();
  } else {
    Alert.alert(title, message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
  }
};

const confirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: onConfirm },
    ]);
  }
};

type Parcel = {
  id: string;
  status: string;
  tracking_token: string;
  content_description: string | null;
  client_name: string | null;
  client_phone: string;
  verified_products: boolean[] | null;
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
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const getCheckedList = (parcel: Parcel, productCount: number) => {
  if (Array.isArray(parcel.verified_products) && parcel.verified_products.length === productCount) {
    return parcel.verified_products;
  }
  return new Array(productCount).fill(false);
};

export default function ConfirmationColisScreen() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [issueMessages, setIssueMessages] = useState<Record<string, string>>({});
  const [sendingIssueIds, setSendingIssueIds] = useState<Record<string, boolean>>({});

  const fetchParcels = useCallback(async () => {
    try {
      const res = await shipmentsAPI.distributionList();
      setParcels(res.data);
    } catch {
      setParcels([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchParcels();
  };

  const toggleProduct = async (parcel: Parcel, productIndex: number) => {
    const products = parseProductNames(parcel.content_description);
    const current = getCheckedList(parcel, products.length);
    const updated = current.map((checked, i) => (i === productIndex ? !checked : checked));

    setParcels((prev) =>
      prev.map((p) => (p.id === parcel.id ? { ...p, verified_products: updated } : p))
    );

    try {
      await shipmentsAPI.updateVerifiedProducts(parcel.id, updated);
    } catch {
      await fetchParcels();
    }
  };

  const handleCloseLoading = async () => {
    setClosing(true);
    try {
      const res = await shipmentsAPI.closeLoading();
      notify(
        'Chargement clôturé',
        `${res.data.closedCount} colis clôturés. Une annonce a été publiée pour les clients.`
      );
      await fetchParcels();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Impossible de clôturer le chargement';
      notify('Erreur', message);
    } finally {
      setClosing(false);
    }
  };

  const confirmCloseLoading = () => {
    confirm(
      'Clôture de chargement',
      'Clôturer tous les colis entièrement confirmés ? Une annonce sera publiée pour les clients.',
      handleCloseLoading
    );
  };

  const handleSendIssue = async (parcel: Parcel) => {
    const message = (issueMessages[parcel.id] || '').trim();
    if (!message) return;

    setSendingIssueIds((prev) => ({ ...prev, [parcel.id]: true }));
    try {
      await shipmentsAPI.reportIssue(parcel.id, message);
      setIssueMessages((prev) => ({ ...prev, [parcel.id]: '' }));
      notify('Message envoyé', "Le signalement a été transmis à l'admin et au client concerné.");
    } catch (err: any) {
      notify('Erreur', err?.response?.data?.error || "Impossible d'envoyer le message");
    } finally {
      setSendingIssueIds((prev) => ({ ...prev, [parcel.id]: false }));
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Confirmation de colis</Text>
      <Text style={styles.subtitle}>
        Cochez chaque produit réellement apporté par la famille du client, pour vérifier qu'il
        correspond à la commande déclarée.
      </Text>

      <TouchableOpacity
        style={[styles.closeLoadingButton, closing && styles.buttonDisabled]}
        onPress={confirmCloseLoading}
        disabled={closing}
      >
        {closing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.closeLoadingButtonText}>Clôture de chargement</Text>
        )}
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#0f4c5c" style={{ marginTop: 30 }} />
      ) : parcels.length === 0 ? (
        <Text style={styles.emptyText}>Aucun colis transféré pour le moment.</Text>
      ) : (
        parcels.map((parcel) => {
          const products = parseProductNames(parcel.content_description);
          const checkedList = getCheckedList(parcel, products.length);
          const checkedCount = checkedList.filter(Boolean).length;

          return (
            <View key={parcel.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardClient} numberOfLines={1}>
                  {parcel.client_name || parcel.client_phone}
                </Text>
                <Text style={styles.cardNumber}>{parcel.tracking_token.slice(0, 8)}</Text>
              </View>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardStatus}>{STATUS_LABELS[parcel.status] || parcel.status}</Text>
                <Text style={styles.cardProgress}>
                  {checkedCount}/{products.length} confirmés
                </Text>
              </View>

              {products.length === 0 ? (
                <Text style={styles.emptyProductsText}>Aucun produit renseigné.</Text>
              ) : (
                products.map((name, index) => {
                  const checked = checkedList[index];
                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.productRow}
                      onPress={() => toggleProduct(parcel, index)}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <Text style={[styles.productLabel, checked && styles.productLabelChecked]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}

              <View style={styles.issueSection}>
                <Text style={styles.issueLabel}>
                  Signaler un problème (envoyé à l'admin et au client concerné)
                </Text>
                <TextInput
                  style={styles.issueInput}
                  value={issueMessages[parcel.id] || ''}
                  onChangeText={(text) =>
                    setIssueMessages((prev) => ({ ...prev, [parcel.id]: text }))
                  }
                  placeholder="Décrire le problème rencontré sur cette commande..."
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.issueButton,
                    (!(issueMessages[parcel.id] || '').trim() || sendingIssueIds[parcel.id]) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => handleSendIssue(parcel)}
                  disabled={!(issueMessages[parcel.id] || '').trim() || sendingIssueIds[parcel.id]}
                >
                  {sendingIssueIds[parcel.id] ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.issueButtonText}>Envoyer</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    color: '#17332c',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    marginTop: 20,
    color: '#6e7069',
    fontSize: 14,
  },
  closeLoadingButton: {
    marginTop: 16,
    backgroundColor: '#b75d4b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeLoadingButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: { opacity: 0.7 },
  card: {
    marginTop: 16,
    backgroundColor: '#fffaf2',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardClient: {
    flex: 1,
    color: '#17332c',
    fontSize: 15,
    fontWeight: '800',
    paddingRight: 8,
  },
  cardNumber: {
    color: '#5f6a65',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  cardStatus: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 12,
  },
  cardProgress: {
    marginTop: 4,
    color: '#0f4c5c',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyProductsText: {
    marginTop: 10,
    color: '#6e7069',
    fontSize: 13,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#b75d4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#b75d4b',
  },
  checkmark: {
    color: '#fffaf2',
    fontSize: 13,
    fontWeight: '800',
  },
  productLabel: {
    flex: 1,
    color: '#374151',
    fontSize: 14,
  },
  productLabelChecked: {
    color: '#17332c',
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  issueSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#eadfce',
    paddingTop: 12,
  },
  issueLabel: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  issueInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  issueButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#0f4c5c',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  issueButtonText: {
    color: '#fffaf2',
    fontSize: 13,
    fontWeight: '800',
  },
});
