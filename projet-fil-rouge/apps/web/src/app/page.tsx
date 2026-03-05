/**
 * Page d'accueil de ShopArch.
 *
 * C'est un Server Component par défaut (pas besoin de "use client").
 * Next.js 14 rend cette page côté serveur automatiquement.
 */
export default function HomePage() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <h1>Bienvenue sur ShopArch</h1>

      <p>
        ShopArch est votre projet fil rouge pour apprendre l&apos;architecture
        logicielle. Vous allez construire une plateforme e-commerce complète,
        module par module.
      </p>

      <nav style={{ marginTop: '2rem' }}>
        <h2>Navigation</h2>
        <ul>
          <li>
            <a href="/catalogue">Catalogue produits</a>
            {' '}&mdash; Parcourir les produits disponibles
          </li>
        </ul>
      </nav>

      <section style={{ marginTop: '2rem', color: '#666' }}>
        <h2>Services disponibles</h2>
        <ul>
          <li>
            <strong>API</strong> :{' '}
            <a href="http://localhost:3001/api/health/liveness">
              http://localhost:3001/api
            </a>
          </li>
          <li>
            <strong>MinIO (S3)</strong> :{' '}
            <a href="http://localhost:9001">http://localhost:9001</a>
          </li>
          <li>
            <strong>Mailhog</strong> :{' '}
            <a href="http://localhost:8025">http://localhost:8025</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
