export const metadata = {
  title: 'Nick und Nico Immobilien – Preiseinschätzung',
  description: 'KI-gestützte Immobilien-Preiseinschätzung',
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
