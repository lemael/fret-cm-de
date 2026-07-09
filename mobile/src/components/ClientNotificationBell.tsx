import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { clientNotificationsAPI } from '../services/api';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OrderDetail'>;

type NotificationItem = {
  type: 'MESSAGE' | 'ANNOUNCEMENT';
  id: string;
  shipmentId?: string;
  title: string;
  body: string;
  createdAt: string;
};

const POLL_INTERVAL_MS = 30000;

export default function ClientNotificationBell() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await clientNotificationsAPI.summary();
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // On garde silencieusement l'état précédent si le polling échoue.
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const openPanel = async () => {
    setVisible(true);
    setLoading(true);
    await fetchSummary();
    // Les annonces sont considérées comme vues dès qu'elles sont affichées ici.
    await clientNotificationsAPI.markAnnouncementsSeen();
    setLoading(false);
  };

  const handlePressItem = (item: NotificationItem) => {
    setVisible(false);
    if (item.type === 'MESSAGE' && item.shipmentId) {
      navigation.navigate('OrderDetail', { shipmentId: item.shipmentId });
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.bellButton} onPress={openPanel}>
        <Text style={styles.bellIcon}>🔔</Text>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.panel} onStartShouldSetResponder={() => true}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#17332c" style={{ marginTop: 20 }} />
            ) : items.length === 0 ? (
              <Text style={styles.emptyText}>Aucune notification</Text>
            ) : (
              <ScrollView style={styles.list}>
                {items.map((item) => (
                  <TouchableOpacity
                    key={`${item.type}-${item.id}`}
                    style={styles.item}
                    onPress={() => handlePressItem(item)}
                  >
                    <Text style={styles.itemTitle}>
                      {item.type === 'ANNOUNCEMENT' ? '📢 ' : '💬 '}
                      {item.title}
                    </Text>
                    <Text style={styles.itemBody}>{item.body}</Text>
                    <Text style={styles.itemDate}>{new Date(item.createdAt).toLocaleString('fr-FR')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 250, 242, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 250, 242, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 18,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#b75d4b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fffaf2',
    fontSize: 10,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 16,
  },
  panel: {
    width: '90%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: '#fffaf2',
    borderRadius: 18,
    padding: 16,
    marginTop: 50,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelTitle: {
    color: '#17332c',
    fontSize: 17,
    fontWeight: '800',
  },
  closeText: {
    color: '#5f6a65',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
    paddingVertical: 16,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f6f1e8',
  },
  itemTitle: {
    color: '#17332c',
    fontWeight: '800',
    fontSize: 13,
  },
  itemBody: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 12,
  },
  itemDate: {
    marginTop: 6,
    color: '#8a8c86',
    fontSize: 11,
  },
});
