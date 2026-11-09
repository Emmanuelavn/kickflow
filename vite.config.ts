import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // En développement, l'API et le temps réel sont relayés vers le serveur local (npm run dev:server)
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/*.png'],
      // Les appels à l'API et aux images ne doivent jamais être servis depuis le cache hors-ligne
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/ws/], importScripts: ['push-sw.js'] },
      manifest: {
        name: 'KickFlow',
        short_name: 'KickFlow',
        description: "L'arène eFootball : défiez vos amis, grimpez au classement.",
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A1628',
        theme_color: '#0A1628',
        icons: [
          { src: 'icons/Icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/Icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/Icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/Icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
