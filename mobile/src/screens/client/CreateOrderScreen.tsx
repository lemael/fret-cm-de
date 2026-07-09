import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ordersAPI } from '../../services/api';
import { RootStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CreateOrder'>;

type ProductRow = { name: string; quantity: string };

const emptyRow = (): ProductRow => ({ name: '', quantity: '1' });

export default function CreateOrderScreen() {
  const navigation = useNavigation<Nav>();
  const [weightKg, setWeightKg] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([emptyRow()]);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const updateProduct = (index: number, field: keyof ProductRow, value: string) => {
    setProducts((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addProductRow = () => setProducts((rows) => [...rows, emptyRow()]);

  const removeProductRow = (index: number) =>
    setProducts((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));

  const handleSubmit = async () => {
    const validProducts = products.filter((p) => p.name.trim());
    if (!weightKg.trim() || validProducts.length === 0 || !pickupAddress.trim() || !deliveryAddress.trim()) {
      Alert.alert('Champs manquants', 'Poids, au moins un produit et les adresses sont obligatoires');
      return;
    }
    const weight = Number(weightKg.replace(',', '.'));
    if (Number.isNaN(weight) || weight <= 0) {
      Alert.alert('Poids invalide', 'Entrez un poids valide en kg');
      return;
    }

    const contentDescription = validProducts
      .map((p) => `${p.quantity.trim() || '1'}x ${p.name.trim()}`)
      .join('\n');

    setLoading(true);
    try {
      await ordersAPI.create({
        weightKg: weight,
        lengthCm: lengthCm ? Number(lengthCm.replace(',', '.')) : undefined,
        widthCm: widthCm ? Number(widthCm.replace(',', '.')) : undefined,
        heightCm: heightCm ? Number(heightCm.replace(',', '.')) : undefined,
        contentDescription,
        pickupAddress: pickupAddress.trim(),
        deliveryAddress: deliveryAddress.trim(),
      });
      Alert.alert('Commande envoyée', "Votre commande a été soumise à l'administrateur.", [
        { text: 'OK', onPress: () => navigation.navigate('ClientHome') },
      ]);
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer la commande");
    } finally {
      setLoading(false);
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

      <Text style={styles.label}>Dimensions (cm)</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder="Longueur"
          keyboardType="numeric"
          value={lengthCm}
          onChangeText={setLengthCm}
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder="Largeur"
          keyboardType="numeric"
          value={widthCm}
          onChangeText={setWidthCm}
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder="Hauteur"
          keyboardType="numeric"
          value={heightCm}
          onChangeText={setHeightCm}
        />
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
          <TextInput
            style={[styles.input, styles.productQtyInput]}
            placeholder="Qté"
            keyboardType="numeric"
            value={product.quantity}
            onChangeText={(value) => updateProduct(index, 'quantity', value)}
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
        placeholder="Adresse en Allemagne"
        value={pickupAddress}
        onChangeText={setPickupAddress}
      />

      <Text style={styles.label}>Adresse de livraison *</Text>
      <TextInput
        style={styles.input}
        placeholder="Adresse au Cameroun"
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowInput: {
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  productNameInput: {
    flex: 2,
  },
  productQtyInput: {
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
});
