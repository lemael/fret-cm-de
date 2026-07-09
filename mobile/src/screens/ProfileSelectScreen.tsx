import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProfileSelect'>;

const PROFILES: {
  key: string;
  title: string;
  subtitle: string;
  screen: keyof RootStackParamList;
}[] = [
  {
    key: 'client',
    title: 'Client',
    subtitle: 'Créer une commande, suivre mes colis, échanger avec l\'équipe',
    screen: 'ClientLogin',
  },
  {
    key: 'gestionnaire',
    title: 'Gestionnaire de colis (Cameroun)',
    subtitle: 'Flux financiers, commissions et litiges',
    screen: 'GestionnaireLogin',
  },
  {
    key: 'admin',
    title: 'Administrateur',
    subtitle: 'Pilotage des dossiers et du transit',
    screen: 'Login',
  },
];

export default function ProfileSelectScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fret CM-DE</Text>
      <Text style={styles.subtitle}>Choisissez votre profil</Text>

      <View style={styles.cardList}>
        {PROFILES.map((profile) => (
          <TouchableOpacity
            key={profile.key}
            style={styles.card}
            onPress={() => navigation.navigate(profile.screen as any)}
          >
            <Text style={styles.cardTitle}>{profile.title}</Text>
            <Text style={styles.cardSubtitle}>{profile.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17332c',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fffaf2',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#d2e0da',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  cardList: {
    gap: 14,
  },
  card: {
    backgroundColor: '#fffaf2',
    borderRadius: 20,
    padding: 18,
  },
  cardTitle: {
    color: '#17332c',
    fontSize: 17,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#5f6a65',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
});
