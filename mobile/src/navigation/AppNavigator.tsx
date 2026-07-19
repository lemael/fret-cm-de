import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ClientDetailScreen from '../screens/ClientDetailScreen';
import AnnouncementsScreen from '../screens/AnnouncementsScreen';
import AnnouncementDetailScreen from '../screens/AnnouncementDetailScreen';
import IncomingOrdersScreen from '../screens/IncomingOrdersScreen';
import DistributionScreen from '../screens/DistributionScreen';
import PriceGridScreen from '../screens/PriceGridScreen';
import ShipmentCalendarScreen from '../screens/ShipmentCalendarScreen';
import ShippedHistoryScreen from '../screens/ShippedHistoryScreen';
import SubscribedClientsScreen from '../screens/SubscribedClientsScreen';

import ClientRegisterScreen from '../screens/client/ClientRegisterScreen';
import ClientHomeScreen from '../screens/client/ClientHomeScreen';
import CreateOrderScreen from '../screens/client/CreateOrderScreen';
import OrderDetailScreen from '../screens/client/OrderDetailScreen';

import FinanceDashboardScreen from '../screens/gestionnaire/FinanceDashboardScreen';
import DisputesScreen from '../screens/gestionnaire/DisputesScreen';
import DisputeDetailScreen from '../screens/gestionnaire/DisputeDetailScreen';
import MessagesInboxScreen from '../screens/gestionnaire/MessagesInboxScreen';
import ConfirmationColisScreen from '../screens/gestionnaire/ConfirmationColisScreen';
import { Dispute } from '../screens/gestionnaire/DisputesScreen';

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  ClientRegister: undefined;

  Dashboard: undefined;
  ClientDetail: { clientId: string };

  ClientHome: undefined;
  CreateOrder: undefined;
  OrderDetail: { shipmentId: string; order?: any };

  FinanceDashboard: undefined;
  Disputes: undefined;
  DisputeDetail: { disputeId: string; dispute: Dispute };
  MessagesInbox: undefined;
  Announcements: undefined;
  IncomingOrders: undefined;
  Distribution: undefined;
  ConfirmationColis: undefined;
  ShippedHistory: undefined;
  SubscribedClients: undefined;
  PriceGrid: undefined;
  ShipmentCalendar: undefined;
  AnnouncementDetail: { announcementId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: '#1a56db' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
};

export default function AppNavigator() {
  const { token, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1a56db" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!token ? (
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Mot de passe oublié' }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: 'Modifier le mot de passe' }}
            />
            <Stack.Screen
              name="ClientRegister"
              component={ClientRegisterScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : role === 'client' ? (
          <>
            <Stack.Screen
              name="ClientHome"
              component={ClientHomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CreateOrder"
              component={CreateOrderScreen}
              options={{ title: 'Nouvelle commande' }}
            />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ title: 'Ma commande' }}
            />
            <Stack.Screen
              name="PriceGrid"
              component={PriceGridScreen}
              options={{ title: 'Grille de prix' }}
            />
            <Stack.Screen
              name="AnnouncementDetail"
              component={AnnouncementDetailScreen}
              options={{ title: 'Annonce' }}
            />
          </>
        ) : role === 'gestionnaire' ? (
          <>
            <Stack.Screen
              name="FinanceDashboard"
              component={FinanceDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Disputes"
              component={DisputesScreen}
              options={{ title: 'Litiges' }}
            />
            <Stack.Screen
              name="DisputeDetail"
              component={DisputeDetailScreen}
              options={{ title: 'Détail du litige' }}
            />
            <Stack.Screen
              name="MessagesInbox"
              component={MessagesInboxScreen}
              options={{ title: 'Messages' }}
            />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ title: 'Conversation' }}
            />
            <Stack.Screen
              name="Announcements"
              component={AnnouncementsScreen}
              options={{ title: 'Annonces' }}
            />
            <Stack.Screen
              name="Distribution"
              component={DistributionScreen}
              options={{ title: 'Chargement des colis' }}
            />
            <Stack.Screen
              name="ConfirmationColis"
              component={ConfirmationColisScreen}
              options={{ title: 'Confirmation de colis' }}
            />
            <Stack.Screen
              name="ShippedHistory"
              component={ShippedHistoryScreen}
              options={{ title: "Historique d'envoi de colis" }}
            />
            <Stack.Screen
              name="SubscribedClients"
              component={SubscribedClientsScreen}
              options={{ title: 'Clients abonnés' }}
            />
            <Stack.Screen
              name="PriceGrid"
              component={PriceGridScreen}
              options={{ title: 'Grille de prix' }}
            />
            <Stack.Screen
              name="ShipmentCalendar"
              component={ShipmentCalendarScreen}
              options={{ title: 'Calendrier des envois' }}
            />
            <Stack.Screen
              name="AnnouncementDetail"
              component={AnnouncementDetailScreen}
              options={{ title: 'Annonce' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ title: 'Fret CM-DE' }}
            />
            <Stack.Screen
              name="ClientDetail"
              component={ClientDetailScreen}
              options={{ title: 'Dossier client' }}
            />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ title: 'Messages du dossier' }}
            />
            <Stack.Screen
              name="Announcements"
              component={AnnouncementsScreen}
              options={{ title: 'Annonces' }}
            />
            <Stack.Screen
              name="IncomingOrders"
              component={IncomingOrdersScreen}
              options={{ title: 'Réception des commandes' }}
            />
            <Stack.Screen
              name="Distribution"
              component={DistributionScreen}
              options={{ title: 'Arrivée des colis' }}
            />
            <Stack.Screen
              name="ShippedHistory"
              component={ShippedHistoryScreen}
              options={{ title: "Historique d'envoi de colis" }}
            />
            <Stack.Screen
              name="SubscribedClients"
              component={SubscribedClientsScreen}
              options={{ title: 'Clients abonnés' }}
            />
            <Stack.Screen
              name="PriceGrid"
              component={PriceGridScreen}
              options={{ title: 'Grille de prix' }}
            />
            <Stack.Screen
              name="ShipmentCalendar"
              component={ShipmentCalendarScreen}
              options={{ title: 'Calendrier des envois' }}
            />
            <Stack.Screen
              name="AnnouncementDetail"
              component={AnnouncementDetailScreen}
              options={{ title: 'Annonce' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
