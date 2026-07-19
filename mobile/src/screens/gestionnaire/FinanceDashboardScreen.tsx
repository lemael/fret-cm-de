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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import {
  financeAPI,
  shipmentsAPI,
  shipmentScheduleAPI,
  CurrentBatchSummary,
  ShipmentScheduleEntry,
} from '../../services/api';
import NotificationBell from '../../components/NotificationBell';
import HamburgerMenu from '../../components/HamburgerMenu';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FinanceDashboard'>;

type Transaction = {
  id: string;
  amount: string;
  commission_amount: string;
  type: 'COLLECTE' | 'COMMISSION' | 'REVERSEMENT';
  status: string;
  notes: string | null;
  created_at: string;
};

type Totals = {
  total_collected: string;
  total_commission: string;
  total_reversed: string;
};

const TYPE_LABELS: Record<string, string> = {
  COLLECTE: 'Collecte',
  COMMISSION: 'Commission',
  REVERSEMENT: 'Reversement',
};

const formatAmount = (value: string | number) => `${Number(value).toLocaleString('fr-FR')} FCFA`;

const formatShipDate = (value: string | null) => {
  if (!value) return 'Aucun envoi en cours';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Nombre de jours avant lesquels la prochaine date du calendrier remplit
// automatiquement le champ "Date d'envoi" du dashboard gestionnaire.
const AUTO_FILL_WINDOW_DAYS = 28;

const daysUntil = (value: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const nextScheduledEntry = (entries: ShipmentScheduleEntry[]) =>
  entries
    .filter((entry) => daysUntil(entry.shipment_date) >= 0)
    .sort((a, b) => new Date(a.shipment_date).getTime() - new Date(b.shipment_date).getTime())[0] || null;

// Masqué temporairement — à réactiver quand la saisie manuelle de transaction sera prête.
const SHOW_ADD_TRANSACTION_BUTTON = false;
// Masqué temporairement — à réactiver quand le suivi financier sera prêt.
const SHOW_FINANCE_METRICS = false;
const SHOW_RECENT_TRANSACTIONS = false;

export default function FinanceDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<CurrentBatchSummary | null>(null);
  const [batchLoading, setBatchLoading] = useState(true);
  const [scheduleEntries, setScheduleEntries] = useState<ShipmentScheduleEntry[]>([]);
  const [formVisible, setFormVisible] = useState(false);
  const [amount, setAmount] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [type, setType] = useState<'COLLECTE' | 'COMMISSION' | 'REVERSEMENT'>('COLLECTE');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await financeAPI.overview();
      setTotals(res.data.totals);
      setTransactions(res.data.transactions);
    } catch {
      setTotals(null);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchCurrentBatch = useCallback(async () => {
    try {
      const res = await shipmentsAPI.currentBatch();
      setCurrentBatch(res.data);
    } catch {
      setCurrentBatch(null);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await shipmentScheduleAPI.list();
      setScheduleEntries(res.data);
    } catch {
      setScheduleEntries([]);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    fetchCurrentBatch();
    fetchSchedule();
  }, [fetchOverview, fetchCurrentBatch, fetchSchedule]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOverview();
    fetchCurrentBatch();
    fetchSchedule();
  };

  const nextScheduled = nextScheduledEntry(scheduleEntries);
  const nextScheduledInWindow =
    nextScheduled !== null && daysUntil(nextScheduled.shipment_date) <= AUTO_FILL_WINDOW_DAYS;
  const displayedShipDate = nextScheduledInWindow ? nextScheduled!.shipment_date : currentBatch?.shippedAt ?? null;

  const handleAddTransaction = async () => {
    const parsedAmount = Number(amount.replace(',', '.'));
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Montant invalide', 'Entrez un montant valide');
      return;
    }
    setSubmitting(true);
    try {
      await financeAPI.addTransaction({
        amount: parsedAmount,
        commissionAmount: commissionAmount ? Number(commissionAmount.replace(',', '.')) : 0,
        type,
        notes: notes.trim() || undefined,
      });
      setAmount('');
      setCommissionAmount('');
      setNotes('');
      setFormVisible(false);
      await fetchOverview();
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la transaction");
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
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroTitle}>Flux financiers</Text>
          <View style={styles.heroActions}>
            <NotificationBell />
            <HamburgerMenu
              items={[
                { label: 'Voir les litiges', onPress: () => navigation.navigate('Disputes') },
                { label: 'Voir les messages', onPress: () => navigation.navigate('MessagesInbox') },
                // "Chargement des colis" masqué temporairement.
                { label: 'Confirmation de colis', onPress: () => navigation.navigate('ConfirmationColis') },
                { label: "Historique d'envoi de colis", onPress: () => navigation.navigate('ShippedHistory') },
                { label: 'Clients abonnés', onPress: () => navigation.navigate('SubscribedClients') },
                { label: 'Voir les annonces', onPress: () => navigation.navigate('Announcements') },
                { label: 'Grille de prix', onPress: () => navigation.navigate('PriceGrid') },
                { label: 'Calendrier des envois', onPress: () => navigation.navigate('ShipmentCalendar') },
              ]}
              onLogout={logout}
            />
          </View>
        </View>

        {SHOW_FINANCE_METRICS ? (
          loading ? (
            <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{formatAmount(totals?.total_collected || 0)}</Text>
                <Text style={styles.metricLabel}>Collecté</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{formatAmount(totals?.total_commission || 0)}</Text>
                <Text style={styles.metricLabel}>Commissions</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{formatAmount(totals?.total_reversed || 0)}</Text>
                <Text style={styles.metricLabel}>Reversé</Text>
              </View>
            </View>
          )
        ) : null}

        {batchLoading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 20 }} />
        ) : (
          <>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{formatShipDate(displayedShipDate)}</Text>
                <Text style={styles.metricLabel}>
                  Date d'envoi{nextScheduledInWindow ? ' (calendrier)' : ''}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{currentBatch?.loadingPercent ?? 0}%</Text>
                <Text style={styles.metricLabel}>Chargement conteneur</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricValue}>{currentBatch?.expectedCount ?? 0}</Text>
                <Text style={styles.metricLabel}>Commandes attendues</Text>
              </View>
            </View>
            {currentBatch && currentBatch.expectedCount > 0 ? (
              <Text style={styles.batchHelp}>
                {currentBatch.confirmedCount} / {currentBatch.expectedCount} colis confirmés dans
                "Confirmation de colis".
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.panel}>
        {SHOW_ADD_TRANSACTION_BUTTON ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setFormVisible((visible) => !visible)}
          >
            <Text style={styles.addButtonText}>
              {formVisible ? 'Annuler' : 'Ajouter une transaction'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {formVisible ? (
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>Type</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={type} onValueChange={(v) => setType(v as any)}>
                <Picker.Item label="Collecte" value="COLLECTE" />
                <Picker.Item label="Commission" value="COMMISSION" />
                <Picker.Item label="Reversement" value="REVERSEMENT" />
              </Picker>
            </View>

            <Text style={styles.formLabel}>Montant (FCFA)</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="50000"
            />

            <Text style={styles.formLabel}>Commission (FCFA, optionnel)</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={commissionAmount}
              onChangeText={setCommissionAmount}
              placeholder="5000"
            />

            <Text style={styles.formLabel}>Notes (optionnel)</Text>
            <TextInput
              style={styles.formInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Référence, client..."
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleAddTransaction}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {SHOW_RECENT_TRANSACTIONS ? (
          <>
            <Text style={styles.sectionTitle}>Transactions récentes</Text>
            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>Aucune transaction enregistrée.</Text>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id} style={styles.txCard}>
                  <View style={styles.txTopRow}>
                    <Text style={styles.txType}>{TYPE_LABELS[tx.type] || tx.type}</Text>
                    <Text style={styles.txAmount}>{formatAmount(tx.amount)}</Text>
                  </View>
                  {Number(tx.commission_amount) > 0 ? (
                    <Text style={styles.txCommission}>Commission: {formatAmount(tx.commission_amount)}</Text>
                  ) : null}
                  {tx.notes ? <Text style={styles.txNotes}>{tx.notes}</Text> : null}
                  <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString('fr-FR')}</Text>
                </View>
              ))
            )}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { paddingBottom: 24 },
  hero: {
    backgroundColor: '#0f4c5c',
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
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 250, 242, 0.12)',
    borderRadius: 16,
    padding: 12,
  },
  metricValue: {
    color: '#fffaf2',
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#d7eef3',
    fontSize: 12,
    marginTop: 4,
  },
  batchHelp: {
    marginTop: 12,
    color: '#d7eef3',
    fontSize: 12,
  },
  panel: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  addButton: {
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
  pickerWrap: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  formInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
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
  txCard: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  txTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  txType: {
    color: '#17332c',
    fontWeight: '800',
    fontSize: 14,
  },
  txAmount: {
    color: '#17332c',
    fontWeight: '800',
    fontSize: 14,
  },
  txCommission: {
    marginTop: 6,
    color: '#5f6a65',
    fontSize: 12,
  },
  txNotes: {
    marginTop: 6,
    color: '#5f6a65',
    fontSize: 12,
  },
  txDate: {
    marginTop: 8,
    color: '#8a8c86',
    fontSize: 11,
  },
});
