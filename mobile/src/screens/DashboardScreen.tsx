import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  phase: 'LOADING' | 'AT_SEA' | 'DISTRIBUTION';
  category: string;
  status: string;
  departure_date: string | null;
  raw_message: string | null;
  created_at: string;
  name: string | null;
  phone: string;
};

type DashboardOverview = {
  clients: Client[];
  phases: {
    loading: {
      nextDepartureDate: string | null;
      tabs: {
        readyToDepart: ShipmentItem[];
        pendingNotReady: ShipmentItem[];
        claims: ShipmentItem[];
      };
    };
    atSea: {
      tabs: {
        tracking: ShipmentItem[];
        claims: ShipmentItem[];
      };
    };
    distribution: {
      tabs: {
        delivered: ShipmentItem[];
        pendingNotDelivered: ShipmentItem[];
        claims: ShipmentItem[];
      };
    };
  };
};

type PhaseKey = 'loading' | 'atSea' | 'distribution';
type TabKey =
  | 'readyToDepart'
  | 'pendingNotReady'
  | 'claims'
  | 'tracking'
  | 'delivered'
  | 'pendingNotDelivered';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

type WorkflowState = {
  isTransitStarted: boolean;
  activePhase: PhaseKey;
  departureDate: string | null;
};

const PHASE_LABELS: Record<PhaseKey, string> = {
  loading: 'Chargement',
  atSea: 'En mer',
  distribution: 'Distribution',
};

const PHASE_ACCENTS: Record<PhaseKey, { bg: string; soft: string }> = {
  loading: { bg: '#0f4c5c', soft: '#d7eef3' },
  atSea: { bg: '#1f4f8a', soft: '#dce9fb' },
  distribution: { bg: '#7d4b1a', soft: '#f7e7d4' },
};

const PHASE_TABS: Record<PhaseKey, TabKey[]> = {
  loading: ['readyToDepart', 'pendingNotReady', 'claims'],
  atSea: ['tracking', 'claims'],
  distribution: ['delivered', 'pendingNotDelivered', 'claims'],
};

const TAB_LABELS: Record<TabKey, string> = {
  readyToDepart: 'Colis prets a partir',
  pendingNotReady: 'Colis en attente (pas prets)',
  claims: 'Reclamation',
  tracking: 'Tracking',
  delivered: 'Colis deja distribues',
  pendingNotDelivered: 'Colis en attente (pas distribues)',
};

const TAB_HINTS: Record<TabKey, string> = {
  readyToDepart: 'Dossiers confirms et prets pour le depart.',
  pendingNotReady: 'Dossiers a preparer avant expedition.',
  claims: 'Incidents et problemes clients a traiter.',
  tracking: 'Suivi des colis actuellement en transit maritime.',
  delivered: 'Historique des colis livres aux clients.',
  pendingNotDelivered: 'Colis arrives mais pas encore remis.',
};

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE_CHARGEMENT: 'En attente chargement',
  PRET_A_PARTIR: 'Pret a partir',
  EN_MER: 'En mer',
  TRACKING_EN_COURS: 'Tracking en cours',
  EN_DISTRIBUTION: 'En distribution',
  EN_ATTENTE_DISTRIBUTION: 'En attente distribution',
  DISTRIBUE: 'Distribue',
  LIVRE: 'Livre',
};

const createEmptyOverview = (): DashboardOverview => ({
  clients: [],
  phases: {
    loading: {
      nextDepartureDate: null,
      tabs: {
        readyToDepart: [],
        pendingNotReady: [],
        claims: [],
      },
    },
    atSea: {
      tabs: {
        tracking: [],
        claims: [],
      },
    },
    distribution: {
      tabs: {
        delivered: [],
        pendingNotDelivered: [],
        claims: [],
      },
    },
  },
});

const normalizeOverview = (payload: any): DashboardOverview => {
  const empty = createEmptyOverview();
  if (!payload || typeof payload !== 'object') {
    return empty;
  }

  if (payload.phases) {
    return {
      clients: Array.isArray(payload.clients) ? payload.clients : [],
      phases: {
        loading: {
          nextDepartureDate: payload.phases.loading?.nextDepartureDate || null,
          tabs: {
            readyToDepart: payload.phases.loading?.tabs?.readyToDepart || [],
            pendingNotReady: payload.phases.loading?.tabs?.pendingNotReady || [],
            claims: payload.phases.loading?.tabs?.claims || [],
          },
        },
        atSea: {
          tabs: {
            tracking: payload.phases.atSea?.tabs?.tracking || [],
            claims: payload.phases.atSea?.tabs?.claims || [],
          },
        },
        distribution: {
          tabs: {
            delivered: payload.phases.distribution?.tabs?.delivered || [],
            pendingNotDelivered: payload.phases.distribution?.tabs?.pendingNotDelivered || [],
            claims: payload.phases.distribution?.tabs?.claims || [],
          },
        },
      },
    };
  }

  return {
    clients: Array.isArray(payload.clients) ? payload.clients : [],
    phases: {
      loading: {
        nextDepartureDate: null,
        tabs: {
          readyToDepart: [],
          pendingNotReady: Array.isArray(payload.shipmentRequests) ? payload.shipmentRequests : [],
          claims: [],
        },
      },
      atSea: {
        tabs: {
          tracking: Array.isArray(payload.transportSchedule) ? payload.transportSchedule : [],
          claims: [],
        },
      },
      distribution: {
        tabs: {
          delivered: [],
          pendingNotDelivered: Array.isArray(payload.awaitingDelivery) ? payload.awaitingDelivery : [],
          claims: Array.isArray(payload.recurringQuestions) ? payload.recurringQuestions : [],
        },
      },
    },
  };
};

const formatDate = (value: string | null) => {
  if (!value) return 'Non renseignee';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const normalizeStatus = (status: string) => STATUS_LABELS[status] || status.replaceAll('_', ' ');

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();

  const [overview, setOverview] = useState<DashboardOverview>(createEmptyOverview);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<PhaseKey>('loading');
  const [activeTab, setActiveTab] = useState<TabKey>('readyToDepart');
  const [isTransitStarted, setIsTransitStarted] = useState(false);
  const [isStartFormVisible, setIsStartFormVisible] = useState(false);
  const [departureDateInput, setDepartureDateInput] = useState('');
  const [workflowDepartureDate, setWorkflowDepartureDate] = useState<string | null>(null);

  const persistWorkflowState = useCallback(async (state: WorkflowState) => {
    try {
      await clientsAPI.updateWorkflowState(state);
    } catch {
      // On conserve le comportement local meme si la persistance echoue ponctuellement.
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const [overviewRes, workflowRes] = await Promise.allSettled([
        clientsAPI.overview(),
        clientsAPI.workflowState(),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(normalizeOverview(overviewRes.value.data));
      } else {
        setOverview(createEmptyOverview());
      }

      const fallbackWorkflow: WorkflowState = {
        isTransitStarted: false,
        activePhase: 'loading',
        departureDate: null,
      };

      const workflow =
        workflowRes.status === 'fulfilled'
          ? (workflowRes.value.data as WorkflowState)
          : fallbackWorkflow;

      let restoredPhase: PhaseKey = 'loading';
      if (workflow.activePhase === 'atSea') {
        restoredPhase = 'atSea';
      } else if (workflow.activePhase === 'distribution') {
        restoredPhase = 'distribution';
      }

      setIsTransitStarted(Boolean(workflow.isTransitStarted));
      setWorkflowDepartureDate(workflow.departureDate || null);
      setActivePhase(restoredPhase);
      setActiveTab(PHASE_TABS[restoredPhase][0]);
      setIsStartFormVisible(false);
      setDepartureDateInput('');
      setErrorMessage(
        overviewRes.status === 'fulfilled'
          ? null
          : 'Impossible de charger les files de travail. Verifiez la connexion puis reessayez.'
      );
    } catch {
      setErrorMessage('Impossible de charger les files de travail. Verifiez la connexion puis reessayez.');
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

  const onSelectPhase = (phase: PhaseKey) => {
    setActivePhase(phase);
    setActiveTab(PHASE_TABS[phase][0]);
  };

  const handleOpenStartTransit = () => {
    setIsStartFormVisible(true);
  };

  const handleStartTransit = () => {
    if (!departureDateInput.trim()) {
      return;
    }

    const date = departureDateInput.trim();

    setWorkflowDepartureDate(date);
    setIsTransitStarted(true);
    setIsStartFormVisible(false);
    onSelectPhase('loading');
    void persistWorkflowState({
      isTransitStarted: true,
      activePhase: 'loading',
      departureDate: date,
    });
  };

  const handleCancelStartTransit = () => {
    setIsStartFormVisible(false);
    setDepartureDateInput('');
  };

  const handleFinishCurrentPhase = () => {
    if (activePhase === 'loading') {
      onSelectPhase('atSea');
      void persistWorkflowState({
        isTransitStarted: true,
        activePhase: 'atSea',
        departureDate: workflowDepartureDate,
      });
      return;
    }

    if (activePhase === 'atSea') {
      onSelectPhase('distribution');
      void persistWorkflowState({
        isTransitStarted: true,
        activePhase: 'distribution',
        departureDate: workflowDepartureDate,
      });
      return;
    }

    setIsTransitStarted(false);
    setIsStartFormVisible(false);
    setDepartureDateInput('');
    setWorkflowDepartureDate(null);
    onSelectPhase('loading');
    void persistWorkflowState({
      isTransitStarted: false,
      activePhase: 'loading',
      departureDate: null,
    });
  };

  const handleReturnPreviousPhase = () => {
    if (activePhase === 'atSea') {
      onSelectPhase('loading');
      void persistWorkflowState({
        isTransitStarted: true,
        activePhase: 'loading',
        departureDate: workflowDepartureDate,
      });
      return;
    }

    if (activePhase === 'distribution') {
      onSelectPhase('atSea');
      void persistWorkflowState({
        isTransitStarted: true,
        activePhase: 'atSea',
        departureDate: workflowDepartureDate,
      });
    }
  };

  const getClaimsData = (): ShipmentItem[] => {
    if (activePhase === 'loading') {
      return overview.phases.loading.tabs.claims;
    }
    if (activePhase === 'atSea') {
      return overview.phases.atSea.tabs.claims;
    }
    return overview.phases.distribution.tabs.claims;
  };

  const tabDataMap = useMemo<Record<TabKey, ShipmentItem[]>>(
    () => ({
      readyToDepart: overview.phases.loading.tabs.readyToDepart,
      pendingNotReady: overview.phases.loading.tabs.pendingNotReady,
      claims: getClaimsData(),
      tracking: overview.phases.atSea.tabs.tracking,
      delivered: overview.phases.distribution.tabs.delivered,
      pendingNotDelivered: overview.phases.distribution.tabs.pendingNotDelivered,
    }),
    [overview, activePhase]
  );

  const activeTabs = PHASE_TABS[activePhase];
  const activeItems = tabDataMap[activeTab] || [];
  const canReturnPrevious = activePhase === 'atSea' || activePhase === 'distribution';
  const phaseProgress: PhaseKey[] = ['loading', 'atSea', 'distribution'];

  const totals = useMemo(() => {
    const loadingTotal =
      overview.phases.loading.tabs.readyToDepart.length +
      overview.phases.loading.tabs.pendingNotReady.length +
      overview.phases.loading.tabs.claims.length;

    const atSeaTotal =
      overview.phases.atSea.tabs.tracking.length +
      overview.phases.atSea.tabs.claims.length;

    const distributionTotal =
      overview.phases.distribution.tabs.delivered.length +
      overview.phases.distribution.tabs.pendingNotDelivered.length +
      overview.phases.distribution.tabs.claims.length;

    return {
      clients: overview.clients.length,
      loading: loadingTotal,
      atSea: atSeaTotal,
      distribution: distributionTotal,
      global: loadingTotal + atSeaTotal + distributionTotal,
    };
  }, [overview]);

  const renderShipmentCard = (item: ShipmentItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.card}
      onPress={() => navigation.navigate('ClientDetail', { clientId: item.client_id })}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardTextBlock}>
          <Text style={styles.cardClientName}>{item.name || 'Client inconnu'}</Text>
          <Text style={styles.cardPhone}>{item.phone}</Text>
        </View>
        <Text style={styles.cardStatus}>{normalizeStatus(item.status)}</Text>
      </View>

      {activePhase === 'loading' ? (
        <Text style={styles.cardInfo}>Date de depart: {formatDate(item.departure_date)}</Text>
      ) : null}

      {item.raw_message ? (
        <Text style={styles.cardMessage} numberOfLines={2}>{item.raw_message}</Text>
      ) : null}

      <Text style={styles.cardFooter}>Cree le {formatDate(item.created_at)}</Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerCard}>
          <ActivityIndicator size="large" color="#0f4c5c" />
          <Text style={styles.centerText}>Chargement des phases...</Text>
        </View>
      );
    }

    if (errorMessage && totals.global === 0 && totals.clients === 0) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Le dashboard est indisponible</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Reessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeItems.length === 0) {
      return (
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>Aucun element dans ce tab</Text>
          <Text style={styles.centerText}>{TAB_HINTS[activeTab]}</Text>
        </View>
      );
    }

    return (
      <View style={styles.listWrap}>
        {activeItems.map(renderShipmentCard)}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Pilotage operationnel</Text>
            <Text style={styles.heroTitle}>Files de travail en 3 phases</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Deconnexion</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.heroDescription}>
          Chargement, en mer et distribution avec des tabs metier relies a la base de donnees.
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCardLarge}>
            <Text style={styles.metricValue}>{totals.global}</Text>
            <Text style={styles.metricLabel}>Dossiers dans les files</Text>
          </View>
          <View style={styles.metricColumn}>
            <View style={styles.metricCardSmall}>
              <Text style={styles.metricMiniValue}>{totals.clients}</Text>
              <Text style={styles.metricMiniLabel}>Clients</Text>
            </View>
            <View style={styles.metricCardSmall}>
              <Text style={styles.metricMiniValue}>{totals.loading}</Text>
              <Text style={styles.metricMiniLabel}>Chargement</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('ParseMessage', {})}
        >
          <Text style={styles.primaryActionText}>Analyser un nouveau message</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Workflow de transit</Text>

        {isTransitStarted ? (
          <>
            <Text style={styles.sectionSubtitle}>Phase active</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseTabsRow}>
              {phaseProgress.map((phase) => {
                const active = phase === activePhase;
                return (
                  <View
                    key={phase}
                    style={[
                      styles.phaseTab,
                      { borderColor: PHASE_ACCENTS[phase].soft },
                      active && { backgroundColor: PHASE_ACCENTS[phase].bg, borderColor: PHASE_ACCENTS[phase].bg },
                    ]}
                  >
                    <Text style={[styles.phaseTabText, active && styles.phaseTabTextActive]}>{PHASE_LABELS[phase]}</Text>
                  </View>
                );
              })}
            </ScrollView>

            {activePhase === 'loading' ? (
              <View style={[styles.departureCard, { backgroundColor: PHASE_ACCENTS.loading.soft }]}> 
                <Text style={styles.departureLabel}>Date de depart (phase chargement)</Text>
                <Text style={styles.departureValue}>{formatDate(workflowDepartureDate || overview.phases.loading.nextDepartureDate)}</Text>
              </View>
            ) : null}

            <View style={styles.workflowActionsRow}>
              <TouchableOpacity style={styles.finishPhaseButton} onPress={handleFinishCurrentPhase}>
                <Text style={styles.finishPhaseButtonText}>Fin de cette phase</Text>
              </TouchableOpacity>
              {canReturnPrevious ? (
                <TouchableOpacity style={styles.backPhaseButton} onPress={handleReturnPreviousPhase}>
                  <Text style={styles.backPhaseButtonText}>Retour a la phase precedente</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.sectionSubtitle}>Tabs de la phase {PHASE_LABELS[activePhase].toLowerCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsRow}>
              {activeTabs.map((tab) => {
                const active = tab === activeTab;
                const count = tabDataMap[tab]?.length || 0;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.subTab, active && styles.subTabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.subTabCount, active && styles.subTabCountActive]}>{count}</Text>
                    <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{TAB_LABELS[tab]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.tabHint}>{TAB_HINTS[activeTab]}</Text>

            {renderContent()}
          </>
        ) : (
          <View style={styles.workflowStartCard}>
            <Text style={styles.workflowStartTitle}>Les phases sont masquees tant que le transit n'est pas lance.</Text>
            <Text style={styles.workflowStartText}>Cliquez sur le bouton ci-dessous pour debuter le transit.</Text>

            {isStartFormVisible ? (
              <View style={styles.startFormCard}>
                <Text style={styles.startFormLabel}>Date de depart</Text>
                <TextInput
                  style={styles.startFormInput}
                  value={departureDateInput}
                  onChangeText={setDepartureDateInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#8b8c86"
                />
                <View style={styles.startFormActions}>
                  <TouchableOpacity
                    style={styles.cancelStartButton}
                    onPress={handleCancelStartTransit}
                  >
                    <Text style={styles.cancelStartButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.startNowButton, !departureDateInput.trim() && styles.disabledButton]}
                    onPress={handleStartTransit}
                    disabled={!departureDateInput.trim()}
                  >
                    <Text style={styles.startNowButtonText}>Commencer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.startTransitButton} onPress={handleOpenStartTransit}>
                <Text style={styles.startTransitButtonText}>Debuter le transit</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f1e8',
  },
  contentContainer: {
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: '#17332c',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
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
    color: '#d6e4dd',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fffaf2',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '800',
    marginTop: 8,
    maxWidth: 270,
  },
  heroDescription: {
    color: '#d2e0da',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
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
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  metricCardLarge: {
    flex: 1,
    minHeight: 122,
    backgroundColor: '#fffaf2',
    borderRadius: 22,
    padding: 16,
    justifyContent: 'space-between',
  },
  metricValue: {
    color: '#17332c',
    fontSize: 38,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#51655d',
    fontSize: 13,
    fontWeight: '600',
  },
  metricColumn: {
    flex: 1,
    gap: 12,
  },
  metricCardSmall: {
    flex: 1,
    backgroundColor: '#25433b',
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-between',
  },
  metricMiniValue: {
    color: '#fffaf2',
    fontSize: 24,
    fontWeight: '800',
  },
  metricMiniLabel: {
    color: '#d3e0da',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryAction: {
    marginTop: 16,
    backgroundColor: '#b75d4b',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  panel: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#17332c',
    fontSize: 21,
    fontWeight: '800',
  },
  workflowStartCard: {
    marginTop: 12,
    backgroundColor: '#fffaf2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 16,
  },
  workflowStartTitle: {
    color: '#17332c',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  workflowStartText: {
    marginTop: 8,
    color: '#5f6a65',
    fontSize: 13,
    lineHeight: 18,
  },
  startTransitButton: {
    marginTop: 14,
    backgroundColor: '#0f4c5c',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  startTransitButtonText: {
    color: '#fffaf2',
    fontSize: 14,
    fontWeight: '800',
  },
  startFormCard: {
    marginTop: 14,
    backgroundColor: '#f6f1e8',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e3d8c7',
  },
  startFormLabel: {
    color: '#17332c',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  startFormInput: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#d8ccba',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#17332c',
    fontSize: 14,
  },
  startNowButton: {
    backgroundColor: '#b75d4b',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
  },
  startNowButtonText: {
    color: '#fffaf2',
    fontSize: 14,
    fontWeight: '800',
  },
  startFormActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  cancelStartButton: {
    backgroundColor: '#efe4d5',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    flex: 1,
  },
  cancelStartButtonText: {
    color: '#17332c',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  phaseTabsRow: {
    gap: 10,
    paddingTop: 12,
    paddingBottom: 4,
  },
  phaseTab: {
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: '#fffaf2',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  phaseTabText: {
    color: '#17332c',
    fontSize: 14,
    fontWeight: '700',
  },
  phaseTabTextActive: {
    color: '#fffaf2',
  },
  departureCard: {
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  departureLabel: {
    color: '#1b4f5d',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  departureValue: {
    color: '#17332c',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  workflowActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  finishPhaseButton: {
    backgroundColor: '#17332c',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  finishPhaseButtonText: {
    color: '#fffaf2',
    fontSize: 13,
    fontWeight: '800',
  },
  backPhaseButton: {
    backgroundColor: '#efe4d5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backPhaseButtonText: {
    color: '#17332c',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#5f6a65',
    fontSize: 13,
    marginTop: 14,
  },
  subTabsRow: {
    gap: 10,
    paddingTop: 10,
    paddingBottom: 2,
  },
  subTab: {
    width: 210,
    borderRadius: 18,
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    padding: 14,
  },
  subTabActive: {
    backgroundColor: '#17332c',
    borderColor: '#17332c',
  },
  subTabCount: {
    alignSelf: 'flex-start',
    backgroundColor: '#ece4d7',
    color: '#17332c',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  subTabCountActive: {
    backgroundColor: 'rgba(255, 250, 242, 0.2)',
    color: '#fffaf2',
  },
  subTabText: {
    marginTop: 10,
    color: '#17332c',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#fffaf2',
  },
  tabHint: {
    color: '#6d6f68',
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
  },
  listWrap: {
    marginTop: 12,
    gap: 10,
  },
  card: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 20,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardTextBlock: {
    flex: 1,
  },
  cardClientName: {
    color: '#17332c',
    fontSize: 16,
    fontWeight: '800',
  },
  cardPhone: {
    color: '#5f6a65',
    fontSize: 13,
    marginTop: 3,
  },
  cardStatus: {
    color: '#17332c',
    backgroundColor: '#ece4d7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  cardInfo: {
    color: '#375f69',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  cardMessage: {
    marginTop: 10,
    color: '#545f59',
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: 12,
    color: '#8a8c86',
    fontSize: 12,
  },
  centerCard: {
    marginTop: 12,
    backgroundColor: '#fffaf2',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  centerTitle: {
    color: '#17332c',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerText: {
    color: '#6e7069',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  errorCard: {
    marginTop: 12,
    backgroundColor: '#fff2ec',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#efcfc2',
  },
  errorTitle: {
    color: '#7e2b24',
    fontSize: 20,
    fontWeight: '800',
  },
  errorText: {
    color: '#7e3e36',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: '#b75d4b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fffaf2',
    fontSize: 14,
    fontWeight: '800',
  },
});
