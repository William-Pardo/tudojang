import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.FIREBASE_CONFIG': JSON.stringify(env.FIREBASE_CONFIG),
        'process.env.VAPID_KEY': JSON.stringify(env.VAPID_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});