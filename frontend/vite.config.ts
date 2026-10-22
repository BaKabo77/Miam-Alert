import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Port fixe : c'est l'origine autorisée par le CORS de l'API (CORS_ORIGINS).
    port: 5173,
    strictPort: true,
  },
});
