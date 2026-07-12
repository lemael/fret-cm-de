import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { pricingAPI, PricingConfig } from '../services/api';

const toEditableStrings = (config: PricingConfig) => ({
  sizeTiers: config.sizeTiers.map((tier) => ({
    label: tier.label,
    maxSpanCm: String(tier.maxSpanCm),
    maxWeightKg: String(tier.maxWeightKg),
    priceEur: String(tier.priceEur),
    bulkMinCartons: String(tier.bulkMinCartons),
    bulkDiscountEur: String(tier.bulkDiscountEur),
  })),
  bulkKgTiers: config.bulkKgTiers.map((tier) => ({
    minWeightKg: String(tier.minWeightKg),
    pricePerKg: String(tier.pricePerKg),
  })),
  volumetricBracket: {
    minVolumeM3: String(config.volumetricBracket.minVolumeM3),
    maxWeightKg: String(config.volumetricBracket.maxWeightKg),
    priceEur: String(config.volumetricBracket.priceEur),
  },
});

type EditableConfig = ReturnType<typeof toEditableStrings>;

// Schéma d'un carton pour montrer visuellement ce que désigne "côté le plus
// long + côté le plus court" (utilisé pour classer une commande en XL/XXL).
const CartonDiagram = () => (
  <View style={styles.diagramWrap}>
    <View style={styles.diagramRow}>
      <View style={styles.carton}>
        <View style={styles.cartonFlap} />
        <View style={styles.cartonTape} />
      </View>

      <View style={styles.shortSideBracket}>
        <View style={styles.bracketTick} />
        <View style={styles.bracketLineVertical} />
        <View style={styles.bracketTick} />
      </View>
      <Text style={[styles.diagramLabel, styles.shortSideLabel]}>Côté le plus court</Text>
    </View>

    <View style={styles.longSideBracket}>
      <View style={styles.bracketTickHorizontal} />
      <View style={styles.bracketLineHorizontal} />
      <View style={styles.bracketTickHorizontal} />
    </View>
    <Text style={styles.diagramLabel}>Côté le plus long</Text>
  </View>
);

// Cube 1m x 1m x 1m — illustre le seuil "1 m³" du palier volumétrique.
const CubeDiagram = () => (
  <View style={styles.diagramWrap}>
    <View style={styles.diagramRow}>
      <View style={styles.cube}>
        <View style={styles.cartonFlap} />
        <View style={styles.cartonTape} />
      </View>

      <View style={[styles.shortSideBracket, styles.cubeShortSideBracket]}>
        <View style={styles.bracketTick} />
        <View style={styles.bracketLineVertical} />
        <View style={styles.bracketTick} />
      </View>
      <Text style={[styles.diagramLabel, styles.shortSideLabel]}>1 mètre</Text>
    </View>

    <View style={styles.cubeLongSideBracket}>
      <View style={styles.bracketTickHorizontal} />
      <View style={styles.bracketLineHorizontal} />
      <View style={styles.bracketTickHorizontal} />
    </View>
    <Text style={styles.diagramLabel}>1 mètre</Text>
    <Text style={styles.diagramCaption}>
      Toutes les faces du carton mesurent 1 mètre (1 m³).
    </Text>
  </View>
);

const parseNumber = (value: string) => Number(value.replace(',', '.'));

const computeDiscountedPrice = (tier: { priceEur: string; bulkDiscountEur: string }) => {
  const price = parseNumber(tier.priceEur);
  const discount = parseNumber(tier.bulkDiscountEur);
  if (Number.isNaN(price) || Number.isNaN(discount)) return null;
  return price - discount;
};

const toConfig = (editable: EditableConfig): PricingConfig | null => {
  const sizeTiers = editable.sizeTiers.map((tier) => ({
    label: tier.label,
    maxSpanCm: parseNumber(tier.maxSpanCm),
    maxWeightKg: parseNumber(tier.maxWeightKg),
    priceEur: parseNumber(tier.priceEur),
    bulkMinCartons: parseNumber(tier.bulkMinCartons),
    bulkDiscountEur: parseNumber(tier.bulkDiscountEur),
  }));
  const bulkKgTiers = editable.bulkKgTiers.map((tier) => ({
    minWeightKg: parseNumber(tier.minWeightKg),
    pricePerKg: parseNumber(tier.pricePerKg),
  }));
  const volumetricBracket = {
    minVolumeM3: parseNumber(editable.volumetricBracket.minVolumeM3),
    maxWeightKg: parseNumber(editable.volumetricBracket.maxWeightKg),
    priceEur: parseNumber(editable.volumetricBracket.priceEur),
  };

  const allNumbers = [
    ...sizeTiers.flatMap((t) => [t.maxSpanCm, t.maxWeightKg, t.priceEur, t.bulkMinCartons, t.bulkDiscountEur]),
    ...bulkKgTiers.flatMap((t) => [t.minWeightKg, t.pricePerKg]),
    volumetricBracket.minVolumeM3,
    volumetricBracket.maxWeightKg,
    volumetricBracket.priceEur,
  ];
  if (allNumbers.some((n) => Number.isNaN(n))) return null;

  return { sizeTiers, bulkKgTiers, volumetricBracket };
};

export default function PriceGridScreen() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [editable, setEditable] = useState<EditableConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await pricingAPI.get();
      setEditable(toEditableStrings(res.data));
    } catch {
      setEditable(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConfig();
  };

  const updateSizeTier = (
    index: number,
    field: 'maxSpanCm' | 'maxWeightKg' | 'priceEur' | 'bulkMinCartons' | 'bulkDiscountEur',
    value: string
  ) => {
    setEditable((current) => {
      if (!current) return current;
      const sizeTiers = current.sizeTiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier));
      return { ...current, sizeTiers };
    });
  };

  const updateBulkTier = (index: number, field: 'minWeightKg' | 'pricePerKg', value: string) => {
    setEditable((current) => {
      if (!current) return current;
      const bulkKgTiers = current.bulkKgTiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier));
      return { ...current, bulkKgTiers };
    });
  };

  const updateVolumetric = (field: 'minVolumeM3' | 'maxWeightKg' | 'priceEur', value: string) => {
    setEditable((current) =>
      current ? { ...current, volumetricBracket: { ...current.volumetricBracket, [field]: value } } : current
    );
  };

  const handleSave = async () => {
    if (!editable) return;
    const config = toConfig(editable);
    if (!config) {
      Alert.alert('Valeurs invalides', 'Vérifiez que tous les champs contiennent des nombres valides.');
      return;
    }
    setSaving(true);
    try {
      await pricingAPI.update(config);
      Alert.alert('Grille mise à jour', 'La nouvelle grille de prix est enregistrée.');
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer la grille de prix");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f4c5c" />
      </View>
    );
  }

  if (!editable) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Impossible de charger la grille de prix.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.title}>Grille de prix</Text>
      <Text style={styles.subtitle}>
        Comment le prix d'une commande est calculé, selon son poids et ses dimensions.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tailles standard (par colis)</Text>
        <Text style={styles.sectionHelp}>
          Côté le plus long + côté le plus court (cm), et poids maximum.
        </Text>

        <CartonDiagram />

        {editable.sizeTiers.map((tier, index) => (
          <View key={tier.label} style={styles.tierCard}>
            <Text style={styles.tierLabel}>{tier.label}</Text>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Dimensions max (cm)</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.maxSpanCm}
                    onChangeText={(v) => updateSizeTier(index, 'maxSpanCm', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.maxSpanCm} cm</Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Poids max (kg)</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.maxWeightKg}
                    onChangeText={(v) => updateSizeTier(index, 'maxWeightKg', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.maxWeightKg} kg</Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Prix</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.priceEur}
                    onChangeText={(v) => updateSizeTier(index, 'priceEur', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.priceEur} €</Text>
                )}
              </View>
            </View>

            <Text style={styles.discountTitle}>Réduction de prix</Text>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>À partir de (cartons)</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.bulkMinCartons}
                    onChangeText={(v) => updateSizeTier(index, 'bulkMinCartons', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.bulkMinCartons}</Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Réduction</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.bulkDiscountEur}
                    onChangeText={(v) => updateSizeTier(index, 'bulkDiscountEur', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.bulkDiscountEur} €</Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Prix / carton</Text>
                <Text style={styles.readOnlyValue}>
                  {computeDiscountedPrice(tier) ?? '—'} €
                </Text>
              </View>
            </View>
            <Text style={styles.discountHelp}>
              À partir de {tier.bulkMinCartons} cartons {tier.label}, réduction de {tier.bulkDiscountEur} €
              → {computeDiscountedPrice(tier) ?? '—'} €/carton.
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Envois lourds (au kg)</Text>
        <Text style={styles.sectionHelp}>
          Au-delà de ces seuils de poids total, le prix est calculé au kilo.
        </Text>
        {editable.bulkKgTiers.map((tier, index) => (
          <View key={index} style={styles.tierCard}>
            <View style={styles.fieldRow}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>À partir de (kg)</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.minWeightKg}
                    onChangeText={(v) => updateBulkTier(index, 'minWeightKg', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.minWeightKg} kg</Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Prix / kg</Text>
                {isAdmin ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={tier.pricePerKg}
                    onChangeText={(v) => updateBulkTier(index, 'pricePerKg', v)}
                  />
                ) : (
                  <Text style={styles.readOnlyValue}>{tier.pricePerKg} €/kg</Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Palier volumétrique</Text>
        <Text style={styles.sectionHelp}>
          Prix forfaitaire pour un envoi volumineux mais léger.
        </Text>

        <CubeDiagram />

        <View style={styles.tierCard}>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Volume min (m³)</Text>
              {isAdmin ? (
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={editable.volumetricBracket.minVolumeM3}
                  onChangeText={(v) => updateVolumetric('minVolumeM3', v)}
                />
              ) : (
                <Text style={styles.readOnlyValue}>{editable.volumetricBracket.minVolumeM3} m³</Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Poids max (kg)</Text>
              {isAdmin ? (
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={editable.volumetricBracket.maxWeightKg}
                  onChangeText={(v) => updateVolumetric('maxWeightKg', v)}
                />
              ) : (
                <Text style={styles.readOnlyValue}>{editable.volumetricBracket.maxWeightKg} kg</Text>
              )}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Prix</Text>
              {isAdmin ? (
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={editable.volumetricBracket.priceEur}
                  onChangeText={(v) => updateVolumetric('priceEur', v)}
                />
              ) : (
                <Text style={styles.readOnlyValue}>{editable.volumetricBracket.priceEur} €</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {isAdmin ? (
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer la grille</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f1e8' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f1e8' },
  title: {
    color: '#17332c',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
    color: '#5f6a65',
    fontSize: 13,
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    color: '#17332c',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHelp: {
    marginTop: 2,
    marginBottom: 10,
    color: '#5f6a65',
    fontSize: 12,
  },
  diagramWrap: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carton: {
    width: 140,
    height: 90,
    backgroundColor: '#d8b48a',
    borderWidth: 2,
    borderColor: '#8a5a2b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cartonFlap: {
    position: 'absolute',
    top: 18,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#8a5a2b',
  },
  cartonTape: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 14,
    marginLeft: -7,
    backgroundColor: '#c99a63',
  },
  cube: {
    width: 100,
    height: 100,
    backgroundColor: '#d8b48a',
    borderWidth: 2,
    borderColor: '#8a5a2b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  cubeShortSideBracket: {
    height: 100,
  },
  cubeLongSideBracket: {
    width: 100,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  diagramCaption: {
    marginTop: 10,
    color: '#5f6a65',
    fontSize: 12,
    textAlign: 'center',
  },
  shortSideBracket: {
    marginLeft: 10,
    height: 90,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bracketTick: {
    width: 10,
    height: 2,
    backgroundColor: '#17332c',
  },
  bracketLineVertical: {
    width: 2,
    flex: 1,
    backgroundColor: '#17332c',
  },
  shortSideLabel: {
    marginLeft: 8,
    maxWidth: 70,
  },
  longSideBracket: {
    width: 140,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bracketTickHorizontal: {
    width: 2,
    height: 10,
    backgroundColor: '#17332c',
  },
  bracketLineHorizontal: {
    flex: 1,
    height: 2,
    backgroundColor: '#17332c',
  },
  diagramLabel: {
    marginTop: 6,
    color: '#17332c',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tierCard: {
    backgroundColor: '#fffaf2',
    borderWidth: 1,
    borderColor: '#eadfce',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  tierLabel: {
    color: '#17332c',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  discountTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: '#17332c',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    borderTopWidth: 1,
    borderTopColor: '#eadfce',
    paddingTop: 12,
  },
  discountHelp: {
    marginTop: 8,
    color: '#5f6a65',
    fontSize: 12,
    lineHeight: 17,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  field: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  readOnlyValue: {
    color: '#17332c',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 6,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: '#b75d4b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  saveButtonText: {
    color: '#fffaf2',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    color: '#6e7069',
    fontSize: 14,
  },
});
