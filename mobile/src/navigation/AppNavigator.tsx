import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import ProfileSelectScreen from '../screens/ProfileSelectScreen';
import LoginScreen from '../screens/LoginScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ParseMessageScreen from '../screens/ParseMessageScreen';
import ClientDetailScreen from '../screens/ClientDetailScreen';

import ClientLoginScreen from '../screens/client/ClientLoginScreen';
import ClientRegisterScreen from '../screens/client/ClientRegisterScreen';
import ClientHomeScreen from '../screens/client/ClientHomeScreen';
import CreateOrderScreen from '../screens/client/CreateOrderScreen';
import OrderDetailScreen from '../screens/client/OrderDetailScreen';

import GestionnaireLoginScreen from '../screens/gestionnaire/GestionnaireLoginScreen';
import FinanceDashboardScreen from '../screens/gestionnaire/FinanceDashboardScreen';
import DisputesScreen from '../screens/gestionnaire/DisputesScreen';
import DisputeDetailScreen from '../screens/gestionnaire/DisputeDetailScreen';
import { Dispute } from '../screens/gestionnaire/DisputesScreen';

export type RootStackParamList = {
  ProfileSelect: undefined;
  Login: undefined;
  ResetPassword: undefined;
  ClientLogin: undefined;
  ClientRegister: undefined;
  GestionnaireLogin: undefined;

  Dashboard: undefined;
  ParseMessage: { clientId?: string; phone?: string };
  ClientDetail: { clientId: string };

  ClientHome: undefined;
  CreateOrder: undefined;
  OrderDetail: { shipmentId: string; order?: any };

  FinanceDashboard: undefined;
  Disputes: undefined;
  DisputeDetail: { disputeId: string; dispute: Dispute };
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
              name="ProfileSelect"
              component={ProfileSelectScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: 'Modifier le mot de passe' }}
            />
            <Stack.Screen
              name="ClientLogin"
              component={ClientLoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ClientRegister"
              component={ClientRegisterScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GestionnaireLogin"
              component={GestionnaireLoginScreen}
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
          </>
        ) : (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ title: 'Fret CM-DE' }}
            />
            <Stack.Screen
              name="ParseMessage"
              component={ParseMessageScreen}
              options={{ title: 'Analyser un message' }}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
