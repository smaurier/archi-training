import type { Metadata } from 'next';

/**
 * Métadonnées globales de l'application.
 * Next.js les injecte automatiquement dans le <head> de chaque page.
 */
export const metadata: Metadata = {
  title: 'ShopArch',
  description:
    'ShopArch — Projet fil rouge de formation en architecture logicielle',
};

/**
 * Layout racine — enveloppe toutes les pages de l'application.
 *
 * En Next.js 14 (App Router), le layout racine DOIT exporter un composant
 * qui contient les balises <html> et <body>.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
