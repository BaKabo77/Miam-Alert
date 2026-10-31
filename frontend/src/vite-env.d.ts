/// <reference types="vite/client" />

// Variables fournies à la construction (voir frontend/Dockerfile). Aucune n'est secrète : elles
// finissent dans le code envoyé au navigateur.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_STATS_URL?: string;
  readonly VITE_STATS_WEBSITE_ID?: string;
}
