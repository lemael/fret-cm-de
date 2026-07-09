export default function Home() {
  return (
    <div style={styles.container}>
      <span style={styles.eyebrow}>Fret CM-DE</span>
      <h1 style={styles.title}>Envoyez vos colis d'Allemagne au Cameroun en toute simplicité</h1>
      <p style={styles.pitch}>
        Créez votre compte, suivez vos commandes en temps réel, échangez directement avec notre
        équipe et recevez nos annonces — tout depuis l'application mobile Fret CM-DE.
      </p>

      <a href="/updates/app-latest.apk" download style={styles.downloadButton}>
        📱 Télécharger l'application (Android)
      </a>
      <p style={styles.downloadHint}>
        Fichier APK — autorisez l'installation depuis une source inconnue si votre téléphone le
        demande.
      </p>

      <div style={styles.divider} />

      <p style={styles.footerHint}>
        Vous avez reçu un lien de suivi par WhatsApp ? Ouvrez-le directement pour voir le statut de
        votre colis.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#17332c',
    padding: '32px 20px',
    textAlign: 'center',
  },
  eyebrow: {
    color: '#d2e0da',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  title: {
    color: '#fffaf2',
    fontSize: 32,
    fontWeight: 800,
    lineHeight: 1.3,
    maxWidth: 560,
    marginBottom: 16,
  },
  pitch: {
    color: '#d2e0da',
    fontSize: 16,
    lineHeight: 1.6,
    maxWidth: 480,
    marginBottom: 32,
  },
  downloadButton: {
    display: 'inline-block',
    backgroundColor: '#b75d4b',
    color: '#fffaf2',
    fontSize: 17,
    fontWeight: 800,
    textDecoration: 'none',
    padding: '16px 32px',
    borderRadius: 14,
  },
  downloadHint: {
    color: '#9fb3ab',
    fontSize: 13,
    marginTop: 12,
    maxWidth: 360,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: '#3a5a51',
    margin: '32px 0 20px',
  },
  footerHint: {
    color: '#9fb3ab',
    fontSize: 14,
    maxWidth: 320,
  },
};
