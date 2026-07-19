import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ordersAPI,
  pricingAPI,
  clientsAPI,
  PricingConfig,
  SizeCategory,
  CreateOrderPayload,
} from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AGB_TEXT } from '../../data/agbText';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CreateOrder'>;

type ProductRow = { name: string };

const emptyRow = (): ProductRow => ({ name: '' });

const FORBIDDEN_ITEMS = [
  'Poisson ; poisson ; viande ; crevettes séchées ou fraîches, cubes et préparations, chocolat & cacao',
  'Miel et tous les produits contenant du lait ou de la graisse',
  'Huiles ; alcools ; et tous les produits liquides et cosmétiques',
  "Tous les produits périssables au bout d'au moins 60 jours",
  'Tous les produits en bois ou fabrications en bois',
  "Tous les produits de haute valeur ou produits d'une valeur supérieure à 50 €",
  'Toutes les contrefaçons',
  'Tous les produits contenant du cuivre',
];

const SIZE_CATEGORY_OPTIONS: { label: string; value: SizeCategory }[] = [
  { label: 'XL', value: 'XL' },
  { label: 'XXL', value: 'XXL' },
  { label: '1 m³', value: 'VOLUMETRIC_1M3' },
  { label: '1000 kg <= x <= 1999 kg', value: 'BULK_1000_1999' },
  { label: '2000 kg <= x <= 2999 kg', value: 'BULK_2000_2999' },
  { label: '3000 kg <= x', value: 'BULK_3000_PLUS' },
];

// Reproduit la logique de calcul du backend (services/pricing.js) à partir
// de la grille de prix, pour afficher un prix estimé pendant la saisie.
const computeEstimatedPrice = (
  weightKgInput: string,
  sizeCategory: SizeCategory,
  config: PricingConfig | null
): number | null => {
  if (!config) return null;

  if (sizeCategory === 'XL' || sizeCategory === 'XXL') {
    const tier = config.sizeTiers.find((t) => t.label === sizeCategory);
    return tier ? tier.priceEur : null;
  }
  if (sizeCategory === 'VOLUMETRIC_1M3') {
    return config.volumetricBracket.priceEur;
  }

  const weight = Number(weightKgInput.replace(',', '.'));
  if (!weight || Number.isNaN(weight) || weight <= 0) return null;

  const bulkTier = [...config.bulkKgTiers]
    .sort((a, b) => b.minWeightKg - a.minWeightKg)
    .find((tier) => weight >= tier.minWeightKg);
  return bulkTier ? Number((weight * bulkTier.pricePerKg).toFixed(2)) : null;
};

const formatEstimatedPrice = (price: number | null) =>
  price === null ? 'À définir' : `${price.toLocaleString('fr-FR')} €`;

// Alert.alert() ne fait rien sur Expo web (react-native-web ne l'implémente pas) —
// on retombe sur window.alert dans ce cas pour que le message s'affiche réellement.
const notify = (title: string, message: string, onDismiss?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    onDismiss?.();
  } else {
    Alert.alert(title, message, onDismiss ? [{ text: 'OK', onPress: onDismiss }] : undefined);
  }
};

export default function CreateOrderScreen() {
  const navigation = useNavigation<Nav>();
  const [weightKg, setWeightKg] = useState('');
  const [sizeCategory, setSizeCategory] = useState<SizeCategory>('XL');
  const [products, setProducts] = useState<ProductRow[]>([emptyRow()]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [clientPhone, setClientPhone] = useState('');
  const [subNom, setSubNom] = useState('');
  const [subPrenom, setSubPrenom] = useState('');
  const [subStreet, setSubStreet] = useState('');
  const [subPostalCode, setSubPostalCode] = useState('');
  const [subCity, setSubCity] = useState('');
  const [subAccepted, setSubAccepted] = useState(false);

  useEffect(() => {
    pricingAPI
      .get()
      .then((res) => setPricingConfig(res.data))
      .catch(() => setPricingConfig(null));

    clientsAPI
      .subscriptionStatus()
      .then((res) => {
        setIsSubscribed(res.data.is_subscribed);
        setClientPhone(res.data.phone || '');
        setSubNom(res.data.name || '');
        setSubPrenom(res.data.first_name || '');
        setSubStreet(res.data.street || '');
        setSubPostalCode(res.data.postal_code || '');
        setSubCity(res.data.city || '');
      })
      .catch(() => setIsSubscribed(false));
  }, []);

  const estimatedPrice = computeEstimatedPrice(weightKg, sizeCategory, pricingConfig);

  const updateProduct = (index: number, field: keyof ProductRow, value: string) => {
    setProducts((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addProductRow = () => setProducts((rows) => [...rows, emptyRow()]);

  const removeProductRow = (index: number) =>
    setProducts((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));

  const buildOrderPayload = (): CreateOrderPayload | null => {
    const validProducts = products.filter((p) => p.name.trim());
    if (!weightKg.trim() || validProducts.length === 0 || !pickupAddress.trim() || !deliveryAddress.trim()) {
      notify('Champs manquants', 'Poids, au moins un produit et les adresses sont obligatoires');
      return null;
    }
    const weight = Number(weightKg.replace(',', '.'));
    if (Number.isNaN(weight) || weight <= 0) {
      notify('Poids invalide', 'Entrez un poids valide en kg');
      return null;
    }

    return {
      weightKg: weight,
      sizeCategory,
      contentDescription: validProducts.map((p) => p.name.trim()).join('\n'),
      pickupAddress: pickupAddress.trim(),
      deliveryAddress: deliveryAddress.trim(),
    };
  };

  const submitOrder = async (payload: CreateOrderPayload) => {
    setLoading(true);
    try {
      await ordersAPI.create(payload);
      notify('Commande envoyée', "Votre commande a été soumise à l'administrateur.", () =>
        navigation.navigate('ClientHome')
      );
    } catch {
      notify('Erreur', "Impossible d'envoyer la commande");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    const payload = buildOrderPayload();
    if (!payload) return;

    if (!isSubscribed) {
      setShowSubscriptionForm(true);
      return;
    }

    submitOrder(payload);
  };

  const handleSubscribe = async () => {
    if (
      !subNom.trim() ||
      !subPrenom.trim() ||
      !subStreet.trim() ||
      !subPostalCode.trim() ||
      !subCity.trim()
    ) {
      notify('Champs manquants', "Tous les champs de l'abonnement sont obligatoires");
      return;
    }
    if (!subAccepted) {
      notify(
        'Conditions non acceptées',
        'Vous devez accepter les conditions générales de Phiju Agency pour vous abonner'
      );
      return;
    }

    setSubscribing(true);
    try {
      await clientsAPI.subscribe({
        nom: subNom.trim(),
        prenom: subPrenom.trim(),
        street: subStreet.trim(),
        postalCode: subPostalCode.trim(),
        city: subCity.trim(),
        accepted: true,
      });
      setIsSubscribed(true);
      setShowSubscriptionForm(false);

      const payload = buildOrderPayload();
      if (payload) {
        await submitOrder(payload);
      } else {
        notify('Abonnement confirmé', 'Vous pouvez maintenant soumettre votre commande.');
      }
    } catch {
      notify('Erreur', "Impossible de finaliser l'abonnement");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Poids (kg) *</Text>
      <TextInput
        style={styles.input}
        placeholder="12"
        keyboardType="numeric"
        value={weightKg}
        onChangeText={setWeightKg}
      />

      <Text style={styles.label}>Taille du colis *</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={sizeCategory} onValueChange={(v) => setSizeCategory(v as SizeCategory)}>
          {SIZE_CATEGORY_OPTIONS.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Prix</Text>
      <View style={styles.priceBox}>
        <Text style={styles.priceValue}>{formatEstimatedPrice(estimatedPrice)}</Text>
      </View>

      <Text style={styles.label}>Produits du colis *</Text>
      {products.map((product, index) => (
        <View key={index} style={styles.productRow}>
          <TextInput
            style={[styles.input, styles.productNameInput]}
            placeholder="Ex: Chaussures"
            value={product.name}
            onChangeText={(value) => updateProduct(index, 'name', value)}
          />
          {products.length > 1 ? (
            <TouchableOpacity style={styles.removeButton} onPress={() => removeProductRow(index)}>
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ))}

      <TouchableOpacity style={styles.addProductButton} onPress={addProductRow}>
        <Text style={styles.addProductButtonText}>+ Ajouter un produit</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Adresse d'enlèvement *</Text>
      <TextInput
        style={styles.input}
        placeholder="Adresse au Cameroun"
        value={pickupAddress}
        onChangeText={setPickupAddress}
      />

      <Text style={styles.label}>Adresse de livraison *</Text>
      <TextInput
        style={styles.input}
        placeholder="Adresse en Allemagne"
        value={deliveryAddress}
        onChangeText={setDeliveryAddress}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Soumettre à l'administrateur</Text>
        )}
      </TouchableOpacity>

      <View style={styles.forbiddenCard}>
        <Text style={styles.forbiddenTitle}>Articles strictement interdits dans le conteneur</Text>
        {FORBIDDEN_ITEMS.map((item, index) => (
          <Text key={index} style={styles.forbiddenItem}>
            • {item}
          </Text>
        ))}
        <Text style={styles.forbiddenWarning}>
          Tout colis interdit qui entre au magasin est confisqué.
        </Text>
      </View>

      <Modal
        visible={showSubscriptionForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubscriptionForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.modalTitle}>Abonnement requis</Text>
              <Text style={styles.modalSubtitle}>
                Un abonnement est nécessaire avant de soumettre votre première commande.
              </Text>
              <View style={styles.feeBox}>
                <Text style={styles.feeText}>Frais d'abonnement : 60 €</Text>
              </View>

              <Text style={styles.label}>Nom *</Text>
              <TextInput style={styles.input} value={subNom} onChangeText={setSubNom} />

              <Text style={styles.label}>Prénom *</Text>
              <TextInput style={styles.input} value={subPrenom} onChangeText={setSubPrenom} />

              <Text style={styles.label}>Téléphone</Text>
              <View style={[styles.input, styles.readOnlyInput]}>
                <Text style={styles.readOnlyValue}>{clientPhone}</Text>
              </View>

              <Text style={styles.label}>Straße *</Text>
              <TextInput style={styles.input} value={subStreet} onChangeText={setSubStreet} />

              <Text style={styles.label}>PLZ *</Text>
              <TextInput
                style={styles.input}
                value={subPostalCode}
                onChangeText={setSubPostalCode}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Stadt *</Text>
              <TextInput style={styles.input} value={subCity} onChangeText={setSubCity} />

              <Text style={styles.label}>Conditions générales (Phiju Agency) *</Text>
              <ScrollView style={styles.agbBox} nestedScrollEnabled>
                <Text style={styles.agbText}>{AGB_TEXT}</Text>
              </ScrollView>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setSubAccepted((v) => !v)}
              >
                <View style={[styles.checkbox, subAccepted && styles.checkboxChecked]}>
                  {subAccepted ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  J'ai lu et j'accepte les conditions générales de Phiju Agency
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, subscribing && styles.buttonDisabled]}
                onPress={handleSubscribe}
                disabled={subscribing}
              >
                {subscribing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>S'abonner (60 €)</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSubscriptionForm(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerWrap: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  priceBox: {
    backgroundColor: '#fdf0e3',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0dcc0',
  },
  priceValue: {
    color: '#17332c',
    fontSize: 18,
    fontWeight: '800',
  },
  productRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  productNameInput: {
    flex: 1,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '700',
  },
  addProductButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  addProductButtonText: {
    color: '#1a56db',
    fontSize: 14,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#b75d4b',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  forbiddenCard: {
    marginTop: 24,
    marginBottom: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 14,
  },
  forbiddenTitle: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  forbiddenItem: {
    color: '#7f1d1d',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  forbiddenWarning: {
    marginTop: 8,
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 51, 44, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#f6f1e8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    color: '#17332c',
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
    lineHeight: 18,
  },
  feeBox: {
    marginTop: 14,
    backgroundColor: '#fdf0e3',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0dcc0',
  },
  feeText: {
    color: '#17332c',
    fontSize: 15,
    fontWeight: '800',
  },
  readOnlyInput: {
    justifyContent: 'center',
  },
  readOnlyValue: {
    color: '#6b7280',
    fontSize: 15,
  },
  agbBox: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    maxHeight: 260,
  },
  agbText: {
    color: '#374151',
    fontSize: 11,
    lineHeight: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#b75d4b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#b75d4b',
  },
  checkmark: {
    color: '#fffaf2',
    fontSize: 13,
    fontWeight: '800',
  },
  checkboxLabel: {
    flex: 1,
    color: '#374151',
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
});
