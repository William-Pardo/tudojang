import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const getEnv = (key: string) => process.env[key] ?? env[key];
  const firebaseApiKey = mode === 'e2e' ? undefined : getEnv('VITE_FIREBASE_API_KEY');
  return {
    define: {
      'process.env.FIREBASE_CONFIG': JSON.stringify(mode === 'e2e' ? undefined : getEnv('FIREBASE_CONFIG')),
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(firebaseApiKey),
      'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(getEnv('VITE_FIREBASE_AUTH_DOMAIN')),
      'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(getEnv('VITE_FIREBASE_PROJECT_ID')),
      'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(getEnv('VITE_FIREBASE_STORAGE_BUCKET')),
      'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID')),
      'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(getEnv('VITE_FIREBASE_APP_ID')),
      'process.env.VAPID_KEY': JSON.stringify(getEnv('VAPID_KEY')),
      'process.env.VITE_ASSISTANT_CATALOG_V1': JSON.stringify(getEnv('VITE_ASSISTANT_CATALOG_V1')),
      'process.env.VITE_ASSISTANT_AI_ENABLED': JSON.stringify(getEnv('VITE_ASSISTANT_AI_ENABLED')),
      'process.env.VITE_ASSISTANT_ESCALATION_ENABLED': JSON.stringify(getEnv('VITE_ASSISTANT_ESCALATION_ENABLED')),
      'process.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY': JSON.stringify(getEnv('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY')),
      'process.env.VITE_GOOGLE_PICKER_API_KEY': JSON.stringify(getEnv('VITE_GOOGLE_PICKER_API_KEY')),
      'process.env.VITE_GOOGLE_PICKER_CLIENT_ID': JSON.stringify(getEnv('VITE_GOOGLE_PICKER_CLIENT_ID')),
      'process.env.VITE_GOOGLE_PICKER_APP_ID': JSON.stringify(getEnv('VITE_GOOGLE_PICKER_APP_ID')),
      'process.env.VITE_GOOGLE_PICKER_ENABLED': JSON.stringify(getEnv('VITE_GOOGLE_PICKER_ENABLED')),
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      }
    }
  };
});
