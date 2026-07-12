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
import { financeAPI } from '../../services/api';
import NotificationBell from '../../components/NotificationBell';
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

export default function FinanceDashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOverview();
  };

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
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
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
        )}

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('Disputes')}>
            <Text style={styles.navLinkText}>Voir les litiges</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('MessagesInbox')}>
            <Text style={styles.navLinkText}>Voir les messages</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('Distribution')}>
            <Text style={styles.navLinkText}>Chargement des colis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('ConfirmationColis')}>
            <Text style={styles.navLinkText}>Confirmation de colis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('ShippedHistory')}>
            <Text style={styles.navLinkText}>Historique d'envoi de colis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('SubscribedClients')}>
            <Text style={styles.navLinkText}>Clients abonnés</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('Announcements')}>
            <Text style={styles.navLinkText}>Voir les annonces</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navLink} onPress={() => navigation.navigate('PriceGrid')}>
            <Text style={styles.navLinkText}>Grille de prix</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.panel}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setFormVisible((visible) => !visible)}
        >
          <Text style={styles.addButtonText}>
            {formVisible ? 'Annuler' : 'Ajouter une transaction'}
          </Text>
        </TouchableOpacity>

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
  navRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  navLink: {
    alignSelf: 'flex-start',
  },
  navLinkText: {
    color: '#dbeafe',
    textDecorationLine: 'underline',
    fontSize: 13,
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
