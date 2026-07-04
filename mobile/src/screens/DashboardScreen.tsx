import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  ListRenderItem,
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

type ShipmentItem = {
  id: string;
  client_id: string;
  name: string | null;
  phone: string;
  category: string;
  status: string;
  raw_message: string | null;
  created_at: string;
};

type DashboardOverview = {
  clients: Client[];
  transportSchedule: ShipmentItem[];
  awaitingDelivery: ShipmentItem[];
  shipmentRequests: ShipmentItem[];
  recurringQuestions: ShipmentItem[];
};

type TabKey =
  | 'clients'
  | 'transportSchedule'
  | 'awaitingDelivery'
  | 'shipmentRequests'
  | 'recurringQuestions';

const TAB_LABELS: Record<TabKey, string> = {
  clients: 'Clients enregistres',
  transportSchedule: 'Calendrier transport',
  awaitingDelivery: 'Colis en attente',
  shipmentRequests: 'Demandes d\'envoi',
  recurringQuestions: 'Questions recurrentes',
};

const TAB_ORDER: TabKey[] = [
  'clients',
  'transportSchedule',
  'awaitingDelivery',
  'shipmentRequests',
  'recurringQuestions',
];

const CATEGORY_LABELS: Record<string, string> = {
  ARRIVAL: 'Suivi arrivee',
  CLAIM: 'Reclamation',
  SHIPMENT: 'Envoi',
  SCHEDULE: 'Calendrier',
  CUSTOMS: 'Douane',
  UNKNOWN: 'Question diverse',
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  clients: 'Retrouvez la fiche d\'un client et ouvrez son detail en un geste.',
  transportSchedule: 'Messages lies au calendrier de depart et d\'arrivee.',
  awaitingDelivery: 'Colis deja recenses qui attendent une remise au client.',
  shipmentRequests: 'Demandes d\'expedition a traiter par priorite.',
  recurringQuestions: 'Questions recurrentes a surveiller pour enrichir votre FAQ.',
};

const TAB_MICROCOPY: Record<TabKey, string> = {
  clients: 'Base clients et historique',
  transportSchedule: 'Dates et previsions logistiques',
  awaitingDelivery: 'Dossiers proches de la remise',
  shipmentRequests: 'Nouveaux envois a qualifier',
  recurringQuestions: 'Messages repetes a capitaliser',
};

const EMPTY_TIPS: Record<TabKey, string> = {
  clients: 'Les nouveaux clients apparaitront ici apres l\'analyse d\'un message ou la creation d\'un dossier.',
  transportSchedule: 'Cette file se remplira quand les clients poseront des questions sur les departs ou arrivees.',
  awaitingDelivery: 'Cette zone vous aide a suivre les colis a remettre rapidement au client.',
  shipmentRequests: 'Analysez un nouveau message pour transformer une demande en dossier exploitable.',
  recurringQuestions: 'Quand plusieurs messages se ressemblent, cette file vous aide a repeter moins et repondre mieux.',
};

const TAB_ACTION_COPY: Record<TabKey, string> = {
  clients: 'Explorer les fiches clients',
  transportSchedule: 'Verifier les demandes calendrier',
  awaitingDelivery: 'Traiter les remises prioritaires',
  shipmentRequests: 'Qualifier les nouveaux envois',
  recurringQuestions: 'Identifier les questions a standardiser',
};

const TAB_ACCENTS: Record<TabKey, { bg: string; soft: string; text: string }> = {
  clients: { bg: '#123524', soft: '#d8f0e2', text: '#123524' },
  transportSchedule: { bg: '#0f4c5c', soft: '#d9f1f4', text: '#0f4c5c' },
  awaitingDelivery: { bg: '#a44a3f', soft: '#fde2dc', text: '#7b241c' },
  shipmentRequests: { bg: '#8a5a12', soft: '#f8e7bf', text: '#7c4a03' },
  recurringQuestions: { bg: '#5f3dc4', soft: '#e8e1ff', text: '#4527a0' },
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview>({
    clients: [],
    transportSchedule: [],
    awaitingDelivery: [],
    shipmentRequests: [],
    recurringQuestions: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await clientsAPI.overview();
      setOverview(res.data);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Impossible de charger le tableau de bord pour le moment. Verifiez la connexion puis reessayez.');
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

  const tabCounts: Record<TabKey, number> = {
    clients: overview.clients.length,
    transportSchedule: overview.transportSchedule.length,
    awaitingDelivery: overview.awaitingDelivery.length,
    shipmentRequests: overview.shipmentRequests.length,
    recurringQuestions: overview.recurringQuestions.length,
  };

  const totalRequests =
    tabCounts.transportSchedule +
    tabCounts.awaitingDelivery +
    tabCounts.shipmentRequests +
    tabCounts.recurringQuestions;

  const deliveryPressure = tabCounts.awaitingDelivery + tabCounts.shipmentRequests;

  const focusQueue =
    ([
      'shipmentRequests',
      'awaitingDelivery',
      'transportSchedule',
      'recurringQuestions',
    ] as TabKey[]).reduce<TabKey>(
      (leader, current) => (tabCounts[current] > tabCounts[leader] ? current : leader),
      'shipmentRequests'
    );

  const highlightedTab =
    (Object.entries(tabCounts) as Array<[TabKey, number]>).reduce<TabKey>(
      (leader, current) => (current[1] > tabCounts[leader] ? current[0] : leader),
      'clients'
    );

  const currentAccent = activeTab ? TAB_ACCENTS[activeTab] : TAB_ACCENTS[highlightedTab];
  const activeCount = activeTab ? tabCounts[activeTab] : 0;
  let operationsStatus = 'Suivi actif';
  let operationsMessage = 'Le back-office tourne normalement. Continuez le tri par file de travail pour garder une vue claire.';

  if (totalRequests === 0) {
    operationsStatus = 'Flux calme';
    operationsMessage = 'Aucune demande en attente. Profitez-en pour analyser les nouveaux messages entrants.';
  } else if (deliveryPressure >= 6) {
    operationsStatus = 'Priorites elevees';
    operationsMessage = 'Les remises et nouveaux envois demandent une action rapide. Ouvrez la file recommandee en priorite.';
  }

  const nextActionLabel =
    tabCounts[focusQueue] > 0 ? TAB_ACTION_COPY[focusQueue] : 'Analyser un nouveau message';

  const renderClientCard = (item: Client) => (
    <TouchableOpacity
      style={[styles.card, styles.clientCard]}
      onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>
            {(item.name || item.phone).slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardTextColumn}>
          <Text style={styles.cardEyebrow}>Client</Text>
          <Text style={styles.cardName}>{item.name || 'Client inconnu'}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
        </View>
      </View>
      <Text style={styles.cardFooter}>Ajoute le {formatDate(item.created_at)}</Text>
      <Text style={styles.cardLink}>Ouvrir la fiche client</Text>
    </TouchableOpacity>
  );

  const renderShipmentCard = (item: ShipmentItem, showStatus: boolean) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ClientDetail', { clientId: item.client_id })}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTextColumn}>
          <Text style={styles.cardEyebrow}>Dossier actif</Text>
          <Text style={styles.cardName}>{item.name || 'Client inconnu'}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
        </View>
        <Text style={styles.categoryBadge}>{CATEGORY_LABELS[item.category] || item.category}</Text>
      </View>
      {showStatus ? (
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Statut</Text>
          <Text style={styles.metaText}>{item.status.replaceAll('_', ' ')}</Text>
        </View>
      ) : null}
      {item.raw_message ? (
        <Text style={styles.messagePreview} numberOfLines={2}>{item.raw_message}</Text>
      ) : null}
      <Text style={styles.cardFooter}>Recu le {formatDate(item.created_at)}</Text>
      <Text style={styles.cardLink}>Voir le dossier client</Text>
    </TouchableOpacity>
  );

  const activeShipmentData = (() => {
    switch (activeTab) {
      case 'transportSchedule':
        return overview.transportSchedule;
      case 'awaitingDelivery':
        return overview.awaitingDelivery;
      case 'shipmentRequests':
        return overview.shipmentRequests;
      case 'recurringQuestions':
        return overview.recurringQuestions;
      default:
        return [];
    }
  })();

  const emptyLabels: Record<TabKey, string> = {
    clients: 'Aucun client enregistre',
    transportSchedule: 'Aucune demande de calendrier',
    awaitingDelivery: 'Aucun colis en attente de livraison',
    shipmentRequests: 'Aucune demande d\'envoi en attente',
    recurringQuestions: 'Aucune question recurrente',
  };

  const renderSectionHeader = () => {
    if (!activeTab) {
      return (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderEyebrow}>Prochaine etape</Text>
          <Text style={styles.placeholderTitle}>Choisissez une file de travail selon la priorite du moment.</Text>
          <Text style={styles.placeholder}>
            Commencez par la file recommandee, puis ouvrez les autres uniquement quand vous avez besoin de changer de contexte.
          </Text>
          <View style={styles.recommendationCard}>
            <View style={[styles.recommendationDot, { backgroundColor: TAB_ACCENTS[focusQueue].bg }]} />
            <View style={styles.recommendationCopy}>
              <Text style={styles.recommendationLabel}>Action recommandee</Text>
              <Text style={styles.recommendationTitle}>{nextActionLabel}</Text>
              <Text style={styles.recommendationText}>{TAB_DESCRIPTIONS[focusQueue]}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.sectionBanner, { backgroundColor: currentAccent.soft }]}> 
        <View style={styles.sectionTopRow}>
          <Text style={[styles.sectionEyebrow, { color: currentAccent.text }]}>Section active</Text>
          <Text style={[styles.sectionCount, { color: currentAccent.text }]}>{activeCount} element{activeCount > 1 ? 's' : ''}</Text>
        </View>
        <Text style={styles.sectionTitle}>{TAB_LABELS[activeTab]}</Text>
        <Text style={styles.sectionDescription}>{TAB_DESCRIPTIONS[activeTab]}</Text>
        <Text style={styles.sectionActionHint}>{TAB_ACTION_COPY[activeTab]}</Text>
      </View>
    );
  };

  const renderEmptyState = (message: string, tabKey: TabKey) => (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Rien a afficher pour le moment</Text>
      <Text style={styles.empty}>{message}</Text>
      <Text style={styles.emptyHint}>{EMPTY_TIPS[tabKey]}</Text>
      <TouchableOpacity
        style={styles.secondaryAction}
        onPress={() => navigation.navigate('ParseMessage', {})}
      >
        <Text style={styles.secondaryActionText}>Analyser un message</Text>
      </TouchableOpacity>
    </View>
  );

  let content = renderSectionHeader();

  if (loading) {
    content = (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="large" color="#123524" />
        <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
      </View>
    );
  } else if (errorMessage && totalRequests === 0 && overview.clients.length === 0) {
    content = (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Le tableau de bord n'est pas disponible</Text>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.primaryRetryButton} onPress={handleRefresh}>
          <Text style={styles.primaryRetryLabel}>Reessayer</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (activeTab === 'clients') {
    const renderClientItem: ListRenderItem<Client> = ({ item }) => renderClientCard(item);

    content = (
      <FlatList
        data={overview.clients}
        key="clients"
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={renderSectionHeader}
        ListEmptyComponent={renderEmptyState(emptyLabels.clients, 'clients')}
        renderItem={renderClientItem}
      />
    );
  } else if (activeTab) {
    const renderShipmentItem: ListRenderItem<ShipmentItem> = ({ item }) =>
      renderShipmentCard(
        item,
        activeTab === 'awaitingDelivery' || activeTab === 'shipmentRequests'
      );

    content = (
      <FlatList
        data={activeShipmentData}
        key={activeTab}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListHeaderComponent={renderSectionHeader}
        ListEmptyComponent={renderEmptyState(emptyLabels[activeTab], activeTab)}
        renderItem={renderShipmentItem}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Centre de traitement Fret CM-DE</Text>
            <Text style={styles.heroTitle}>Pilotez les demandes sans perdre le fil</Text>
          </View>
          <TouchableOpacity style={styles.logoutPill} onPress={logout}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusPill}>
          <View style={styles.statusPillDot} />
          <Text style={styles.statusPillText}>{operationsStatus}</Text>
        </View>

        <Text style={styles.heroDescription}>
          {operationsMessage}
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCardPrimary}>
            <Text style={styles.metricCardEyebrow}>Charge du jour</Text>
            <Text style={styles.metricValue}>{totalRequests}</Text>
            <Text style={styles.metricLabel}>Demandes ouvertes a traiter</Text>
          </View>
          <View style={styles.metricColumn}>
            <View style={styles.metricCardSecondary}>
              <Text style={styles.metricMiniValue}>{overview.clients.length}</Text>
              <Text style={styles.metricMiniLabel}>Clients suivis</Text>
            </View>
            <View style={styles.metricCardSecondary}>
              <Text style={styles.metricMiniValue}>{deliveryPressure}</Text>
              <Text style={styles.metricMiniLabel}>Demandes urgentes</Text>
            </View>
          </View>
        </View>

        <View style={styles.priorityStrip}>
          <View style={styles.priorityCopy}>
            <Text style={styles.priorityEyebrow}>Priorite recommandee</Text>
            <Text style={styles.priorityTitle}>{TAB_LABELS[focusQueue]}</Text>
            <Text style={styles.priorityText}>{TAB_MICROCOPY[focusQueue]}</Text>
          </View>
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityBadgeValue}>{tabCounts[focusQueue]}</Text>
            <Text style={styles.priorityBadgeLabel}>a traiter</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('ParseMessage', {})}
        >
          <Text style={styles.primaryActionLabel}>Analyser un nouveau message</Text>
          <Text style={styles.primaryActionHint}>Ajouter une demande dans le circuit de traitement sans quitter le tableau de bord</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabsSection}>
        <View style={styles.tabsSectionHeader}>
          <Text style={styles.tabsSectionTitle}>Files de travail</Text>
          <Text style={styles.tabsSectionHint}>Chaque file correspond a une action metier. Touchez pour ouvrir ou fermer son contenu.</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {TAB_ORDER.map((tabKey) => {
            const isActive = activeTab === tabKey;
            const accent = TAB_ACCENTS[tabKey];

            return (
              <TouchableOpacity
                key={tabKey}
                style={[
                  styles.tabButton,
                  { borderColor: accent.soft },
                  isActive && { backgroundColor: accent.bg, borderColor: accent.bg },
                ]}
                onPress={() => setActiveTab((currentTab) => currentTab === tabKey ? null : tabKey)}
              >
                <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>{tabCounts[tabKey]}</Text>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{TAB_LABELS[tabKey]}</Text>
                <Text style={[styles.tabCaption, isActive && styles.tabCaptionActive]}>{TAB_MICROCOPY[tabKey]}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.contentWrap}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#17332c',
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
    color: '#d9eadf',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fffaf2',
    fontSize: 29,
    lineHeight: 33,
    fontWeight: '800',
    marginTop: 8,
    maxWidth: 260,
  },
  heroDescription: {
    color: '#c6d8cf',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 250, 242, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
    gap: 8,
  },
  statusPillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#f3c969',
  },
  statusPillText: {
    color: '#fffaf2',
    fontSize: 13,
    fontWeight: '700',
  },
  logoutPill: {
    backgroundColor: 'rgba(255, 250, 242, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 250, 242, 0.22)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  metricCardPrimary: {
    flex: 1,
    backgroundColor: '#fffaf2',
    borderRadius: 24,
    padding: 18,
    minHeight: 126,
    justifyContent: 'space-between',
  },
  metricValue: {
    fontSize: 38,
    fontWeight: '800',
    color: '#17332c',
  },
  metricCardEyebrow: {
    color: '#8f6b4f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
    marginBottom: 10,
  },
  metricLabel: {
    color: '#41554f',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  metricColumn: {
    flex: 1,
    gap: 12,
  },
  metricCardSecondary: {
    flex: 1,
    backgroundColor: '#20453b',
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
  },
  metricMiniValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fffaf2',
  },
  metricMiniLabel: {
    color: '#d5e1db',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  priorityStrip: {
    marginTop: 16,
    backgroundColor: '#24463f',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  priorityCopy: {
    flex: 1,
  },
  priorityEyebrow: {
    color: '#d0ddd7',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  priorityTitle: {
    color: '#fffaf2',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 6,
  },
  priorityText: {
    color: '#d7e3de',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  priorityBadge: {
    width: 86,
    height: 86,
    borderRadius: 24,
    backgroundColor: '#fffaf2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  priorityBadgeValue: {
    color: '#17332c',
    fontSize: 28,
    fontWeight: '800',
  },
  priorityBadgeLabel: {
    color: '#50615c',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryAction: {
    backgroundColor: '#b75d4b',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginTop: 18,
  },
  primaryActionLabel: {
    color: '#fffaf2',
    fontSize: 17,
    fontWeight: '800',
  },
  primaryActionHint: {
    color: '#ffe7de',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  tabsSection: {
    paddingTop: 18,
  },
  tabsSectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  tabsSectionTitle: {
    color: '#17332c',
    fontSize: 20,
    fontWeight: '800',
  },
  tabsSectionHint: {
    color: '#6c6a63',
    fontSize: 13,
    marginTop: 4,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 12,
  },
  tabButton: {
    width: 164,
    minHeight: 124,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  tabCount: {
    alignSelf: 'flex-start',
    minWidth: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#efe7d9',
    color: '#17332c',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(255, 250, 242, 0.2)',
    color: '#fffaf2',
  },
  tabText: {
    color: '#17332c',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 14,
  },
  tabTextActive: {
    color: '#fffaf2',
  },
  tabCaption: {
    color: '#6b6d67',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  tabCaptionActive: {
    color: '#dfe9e4',
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionBanner: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
  },
  sectionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#17332c',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  sectionDescription: {
    color: '#4e5f59',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  sectionActionHint: {
    color: '#17332c',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  loadingCard: {
    backgroundColor: '#fffaf2',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: '#fff4f0',
    borderRadius: 28,
    padding: 24,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f0d2c9',
  },
  errorTitle: {
    color: '#7b241c',
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
  },
  errorText: {
    color: '#7b3b32',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  primaryRetryButton: {
    marginTop: 18,
    backgroundColor: '#b75d4b',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryRetryLabel: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  loadingText: {
    color: '#4e5f59',
    fontSize: 15,
    marginTop: 14,
  },
  placeholderCard: {
    backgroundColor: '#fffaf2',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 22,
    marginTop: 8,
  },
  placeholderEyebrow: {
    color: '#b75d4b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  placeholderTitle: {
    color: '#17332c',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  recommendationCard: {
    marginTop: 18,
    backgroundColor: '#f7eee2',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  recommendationDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 4,
  },
  recommendationCopy: {
    flex: 1,
  },
  recommendationLabel: {
    color: '#8f6b4f',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '800',
  },
  recommendationTitle: {
    color: '#17332c',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  recommendationText: {
    color: '#5e655f',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fffaf2',
    marginBottom: 12,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#efe3d3',
  },
  clientCard: {
    backgroundColor: '#fcf7f0',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#17332c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    color: '#fffaf2',
    fontSize: 16,
    fontWeight: '800',
  },
  cardTextColumn: {
    flex: 1,
  },
  cardEyebrow: {
    color: '#8f6b4f',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  categoryBadge: {
    color: '#7c4a03',
    backgroundColor: '#f8e7bf',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  cardName: { fontSize: 18, fontWeight: '700', color: '#17332c' },
  cardPhone: { fontSize: 14, color: '#5e655f', marginTop: 3 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusLabel: {
    color: '#8f6b4f',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaText: {
    color: '#17332c',
    fontSize: 12,
    textTransform: 'capitalize',
    backgroundColor: '#efe7d9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  messagePreview: {
    color: '#4e5f59',
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  cardFooter: {
    color: '#8b8c87',
    fontSize: 12,
    marginTop: 14,
  },
  cardLink: {
    color: '#17332c',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#fffaf2',
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: 'center',
    marginTop: 4,
  },
  emptyTitle: {
    color: '#17332c',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    color: '#6c6a63',
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyHint: {
    textAlign: 'center',
    color: '#8b8c87',
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  secondaryAction: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#17332c',
  },
  secondaryActionText: {
    color: '#fffaf2',
    fontSize: 14,
    fontWeight: '700',
  },
  placeholder: {
    textAlign: 'center',
    color: '#5e655f',
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  logoutText: { color: '#fffaf2', fontSize: 13, fontWeight: '700' },
});
