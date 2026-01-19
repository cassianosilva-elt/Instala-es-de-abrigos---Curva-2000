import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['assets/logo_icon.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000, // Increase limit to 5MB
        },
        manifest: {
          name: 'Eletromidia Field Manager',
          short_name: 'Field Manager',
          description: 'Sistema de Gestão de Operações em Campo',
          theme_color: '#FA3A00',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'assets/logo_icon.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'assets/logo_icon.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: true
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react', 'recharts'],
            'vendor-utils': ['xlsx', 'exceljs']
          }
        }
      }
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
