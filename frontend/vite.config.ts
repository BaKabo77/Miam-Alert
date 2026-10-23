import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Application installable (PWA) : manifeste + service worker qui met l'application en cache,
    // pour qu'elle s'ouvre comme une appli et se charge même sans réseau.
    VitePWA({
      // Une nouvelle version déployée remplace l'ancienne automatiquement.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "Miam'Alert",
        short_name: "Miam'Alert",
        description: 'Garde-manger anti-gaspi : suivez vos dates de péremption.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f3e5d3',
        theme_color: '#b9471f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Seuls les fichiers DE L'APPLICATION sont mis en cache (HTML, JS, CSS, icônes).
        // Les réponses de l'API ne le sont jamais : l'inventaire et le profil resteraient lisibles
        // dans le cache du navigateur après la déconnexion, par exemple sur un appareil partagé.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        // Si l'API est un jour servie sous /api sur le même domaine, ses URL ne doivent pas
        // être confondues avec des pages de l'application.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    // Port fixe : c'est l'origine autorisée par le CORS de l'API (CORS_ORIGINS).
    port: 5173,
    strictPort: true,
  },
});
