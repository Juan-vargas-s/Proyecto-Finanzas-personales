export default function HomePage() {
  return (
    <main style={styles.main}>
      <h1 style={styles.title}>💰 Finanzas Personales</h1>
      <p style={styles.text}>Sistema de finanzas personales en microservicios</p>
      <p style={styles.status}>✓ Frontend Next.js funcionando</p>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    padding: "2rem",
  },
  title: { fontSize: "2.5rem", marginBottom: "0.5rem" },
  text: { fontSize: "1.1rem", color: "#94a3b8" },
  status: { marginTop: "2rem", color: "#4ade80", fontWeight: "bold" },
};
