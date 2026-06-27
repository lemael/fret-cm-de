export default function Home() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Fret CM-DE</h1>
      <p style={styles.sub}>Service de fret Cameroun - Allemagne</p>
      <p style={styles.hint}>
        Utilisez le lien qui vous a été envoyé par WhatsApp pour suivre votre colis.
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
    backgroundColor: '#1a56db',
    padding: '0 20px',
    textAlign: 'center',
  },
  title: { color: '#fff', fontSize: 36, fontWeight: 700, marginBottom: 8 },
  sub: { color: '#bfdbfe', fontSize: 18, marginBottom: 24 },
  hint: { color: '#e0eaff', fontSize: 15, maxWidth: 320 },
};
