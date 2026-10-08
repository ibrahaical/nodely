import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    solid(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand/nodely-logo.png', 'brand/nodely-icon-square.png'],
      manifest: {
        name: 'Nodely',
        short_name: 'Nodely',
        description: 'A fast, keyboard-first outliner for thoughtful notes.',
        theme_color: '#806dcc',
        background_color: '#fbfaff',
        display: 'standalone',
        icons: [
          { src: '/brand/nodely-icon-square.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
