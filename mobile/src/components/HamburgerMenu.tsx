import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

type MenuItem = {
  label: string;
  onPress: () => void;
};

type Props = {
  items: MenuItem[];
  onLogout: () => void;
};

export default function HamburgerMenu({ items, onLogout }: Props) {
  const [visible, setVisible] = useState(false);

  const handleItemPress = (onPress: () => void) => {
    setVisible(false);
    onPress();
  };

  const handleLogout = () => {
    setVisible(false);
    onLogout();
  };

  return (
    <>
      <TouchableOpacity style={styles.menuButton} onPress={() => setVisible(true)}>
        <View style={styles.barsWrap}>
          <View style={styles.bar} />
          <View style={styles.bar} />
          <View style={styles.bar} />
        </View>
      </TouchableOpacity>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.panel} onStartShouldSetResponder={() => true}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.closeText}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.list}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.item}
                  onPress={() => handleItemPress(item.onPress)}
                >
                  <Text style={styles.itemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 250, 242, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 250, 242, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsWrap: {
    gap: 4,
  },
  bar: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fffaf2',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 16,
  },
  panel: {
    width: '80%',
    maxWidth: 320,
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
  list: {
    marginTop: 4,
  },
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eadfce',
  },
  itemText: {
    color: '#17332c',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 16,
    backgroundColor: '#b75d4b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fffaf2',
    fontWeight: '800',
    fontSize: 14,
  },
});
