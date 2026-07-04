import type { GetServerSideProps } from 'next';
import Head from 'next/head';

// ─── Types ────────────────────────────────────────────────────────────────────

type Shipment = {
  category: string;
  status: string;
  name: string | null;
  phone: string;
  created_at: string;
  updated_at: string;
};

type Props = { shipment: Shipment | null };

// ─── Données statiques ────────────────────────────────────────────────────────

const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  ARRIVAL: {
    label: '📦 Suivi de votre colis',
    description: 'Votre demande de suivi a bien été enregistrée.',
  },
  CLAIM: {
    label: '⚠️ Réclamation en cours',
    description: 'Votre réclamation a été transmise à notre équipe.',
  },
  SHIPMENT: {
    label: '🚢 Expédition enregistrée',
    description: 'Votre demande d\'expédition a été créée avec succès.',
  },
  SCHEDULE: {
    label: '📅 Prochains départs',
    description: 'Votre demande d\'information sur les départs a été prise en compte.',
  },
  CUSTOMS: {
    label: '🛃 Douane & produits',
    description: 'Votre question sur les produits autorisés a été enregistrée.',
  },
  UNKNOWN: {
    label: '📋 Demande enregistrée',
    description: 'Votre message a bien été reçu par notre équipe.',
  },
};

const STATUS_STEPS = [
  'EN_ATTENTE',
  'EN_ENTREPOT_FRANCFORT',
  'EN_MER',
  'DOUANE_DOUALA',
  'PRET_RECUPERATION',
  'LIVRE',
];

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente de traitement',
  EN_ENTREPOT_FRANCFORT: 'En entrepôt à Francfort',
  EN_MER: 'En mer',
  DOUANE_DOUALA: 'Douane Douala',
  PRET_RECUPERATION: 'Prêt pour récupération',
  LIVRE: 'Livré ✓',
  PROBLEME: '⚠️ Problème signalé',
};

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StatusPage({ shipment }: Props) {
  if (!shipment) {
    return (
      <>
        <Head>
          <title>Lien invalide - Fret CM-DE</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div style={s.page}>
          <div style={s.header}>
            <h1 style={s.headerTitle}>Fret CM-DE</h1>
            <p style={s.headerSub}>Cameroun - Allemagne</p>
          </div>
          <div style={s.card}>
            <h2 style={{ ...s.catLabel, color: '#ef4444' }}>Lien invalide</h2>
            <p style={s.desc}>
              Ce lien est incorrect ou a expiré. Contactez votre administrateur via WhatsApp.
            </p>
          </div>
        </div>
      </>
    );
  }

  const info = CATEGORY_INFO[shipment.category] ?? CATEGORY_INFO.UNKNOWN;
  const currentStep = STATUS_STEPS.indexOf(shipment.status);
  const updatedDate = new Date(shipment.updated_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <Head>
        <title>Suivi de votre colis - Fret CM-DE</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Suivez l'état de votre colis Cameroun - Allemagne" />
      </Head>

      <div style={s.page}>
        {/* En-tête */}
        <div style={s.header}>
          <h1 style={s.headerTitle}>Fret CM-DE</h1>
          <p style={s.headerSub}>Cameroun - Allemagne</p>
        </div>

        <div style={s.card}>
          {/* Catégorie */}
          <h2 style={s.catLabel}>{info.label}</h2>
          <p style={s.desc}>{info.description}</p>

          {/* Statut actuel */}
          <div style={s.statusBox}>
            <p style={s.statusLabel}>STATUT ACTUEL</p>
            <p style={s.statusValue}>
              {STATUS_LABELS[shipment.status] ?? shipment.status}
            </p>
          </div>

          {/* Timeline de progression */}
          {currentStep >= 0 && (
            <div style={s.timeline}>
              {STATUS_STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                return (
                  <div key={step} style={s.timelineRow}>
                    <div
                      style={{
                        ...s.dot,
                        backgroundColor: done || active ? '#1a56db' : '#e5e7eb',
                        transform: active ? 'scale(1.3)' : 'scale(1)',
                      }}
                    />
                    <span
                      style={{
                        ...s.stepText,
                        fontWeight: active ? 700 : 400,
                        color: done || active ? '#1e3a8a' : '#9ca3af',
                      }}
                    >
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p style={s.updated}>Mis à jour le {updatedDate}</p>
        </div>
      </div>
    </>
  );
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const token = params?.token as string;

  // Validation UUID côté serveur
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return { props: { shipment: null } };
  }

  const apiUrl =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'https://backend-production-0fb10.up.railway.app';

  try {
    const res = await fetch(`${apiUrl}/api/status/${encodeURIComponent(token)}`);
    if (!res.ok) return { props: { shipment: null } };
    const shipment: Shipment = await res.json();
    return { props: { shipment } };
  } catch {
    return { props: { shipment: null } };
  }
};

// ─── Styles inline (pas de CSS externe — page ultra-légère) ───────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    backgroundColor: '#1a56db',
    padding: '28px 20px',
    textAlign: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 26, margin: 0, fontWeight: 700 },
  headerSub: { color: '#bfdbfe', margin: '4px 0 0', fontSize: 14 },
  card: {
    maxWidth: 480,
    margin: '24px auto',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: '24px 20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
  },
  catLabel: { fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 },
  desc: { color: '#6b7280', fontSize: 15, marginBottom: 20 },
  statusBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 24,
  },
  statusLabel: {
    color: '#1a56db',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    letterSpacing: 1,
  },
  statusValue: { color: '#1e3a8a', fontSize: 18, fontWeight: 700 },
  timeline: {
    borderLeft: '2px solid #e5e7eb',
    paddingLeft: 18,
    marginBottom: 24,
  },
  timelineRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginLeft: -24,
    marginRight: 14,
    flexShrink: 0,
    transition: 'background-color 0.2s',
  },
  stepText: { fontSize: 14 },
  updated: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
  },
};
