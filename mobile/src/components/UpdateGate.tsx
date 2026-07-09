import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Modal } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { fetchLatestVersionInfo, isNewerVersion, VersionInfo } from '../services/updateCheck';

type UpdateState = 'checking' | 'upToDate' | 'optional' | 'mandatory';

const UPDATE_URL = Constants.expoConfig?.extra?.updateUrl as string | undefined;

export default function UpdateGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UpdateState>('checking');
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!UPDATE_URL) return;

    fetchLatestVersionInfo(UPDATE_URL).then((remote) => {
      if (!remote) {
        setState('upToDate');
        return;
      }

      const installedCode = Number(Application.nativeBuildVersion ?? '0');
      if (isNewerVersion(remote.versionCode, installedCode)) {
        setInfo(remote);
        setState(remote.mandatory ? 'mandatory' : 'optional');
      } else {
        setState('upToDate');
      }
    });
  }, []);

  const handleUpdate = () => {
    if (info) Linking.openURL(info.apkUrl);
  };

  if (state === 'mandatory' && info) {
    return (
      <View style={styles.mandatoryContainer}>
        <Text style={styles.mandatoryEyebrow}>Mise à jour requise</Text>
        <Text style={styles.mandatoryTitle}>Version {info.latestVersion} disponible</Text>
        <Text style={styles.mandatoryText}>
          Une mise à jour importante doit être installée avant de continuer à utiliser l'application.
        </Text>
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
          <Text style={styles.updateButtonText}>Mettre à jour maintenant</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {children}
      {state === 'optional' && info && !dismissed ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setDismissed(true)}>
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nouvelle version disponible</Text>
              <Text style={styles.cardText}>
                La version {info.latestVersion} de l'application est disponible.
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.laterButton} onPress={() => setDismissed(true)}>
                  <Text style={styles.laterButtonText}>Plus tard</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.updateButtonSmall} onPress={handleUpdate}>
                  <Text style={styles.updateButtonText}>Mettre à jour</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  mandatoryContainer: {
    flex: 1,
    backgroundColor: '#17332c',
    justifyContent: 'center',
    padding: 32,
  },
  mandatoryEyebrow: {
    color: '#d2e0da',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
  mandatoryTitle: {
    color: '#fffaf2',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  mandatoryText: {
    color: '#d2e0da',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
  updateButton: {
    marginTop: 28,
    backgroundColor: '#b75d4b',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fffaf2',
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    color: '#17332c',
    fontSize: 18,
    fontWeight: '800',
  },
  cardText: {
    marginTop: 8,
    color: '#5f6a65',
    fontSize: 14,
    lineHeight: 20,
  },
  cardActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  laterButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ece4d7',
  },
  laterButtonText: {
    color: '#17332c',
    fontSize: 13,
    fontWeight: '700',
  },
  updateButtonSmall: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#b75d4b',
  },
});
