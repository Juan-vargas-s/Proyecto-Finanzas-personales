export const metadata = {
  title: "Finanzas Personales",
  description: "Sistema de finanzas personales en microservicios",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
