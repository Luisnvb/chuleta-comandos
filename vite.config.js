import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { commandEditor } from './scripts/vite-plugin-command-editor.js';

export default defineConfig({
  // The installed PWA is bound to this origin; keep the port fixed so rebuilds can update it.
  preview: { port: 4173, strictPort: true },
  plugins: [
    // Dev only: lets the app edit data/*.yaml (see src/editor.js).
    commandEditor(),
    VitePWA({
      // A new deploy activates on the next load; the command data is bundled, so it updates too.
      registerType: 'autoUpdate',
      // workbox.globPatterns below already precaches every icon.
      includeManifestIcons: false,
      manifest: {
        name: 'Cheatsheet — command quick reference',
        short_name: 'Cheatsheet',
        description: 'Search and copy developer commands, offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#f6f7f9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is precached, so it works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
});
