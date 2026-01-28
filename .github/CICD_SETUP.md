# CI/CD Setup Guide for Firebase Deployment

This guide explains how to configure GitHub Actions for automatic Firebase deployment.

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON | Firebase Console → Project Settings → Service Accounts → Generate new private key |
| `FIREBASE_TOKEN` | Firebase CLI token | Run `firebase login:ci` locally and copy the token |
| `GEMINI_API_KEY` | Google AI API key | [Google AI Studio](https://aistudio.google.com/apikey) |
| `FIREBASE_CONFIG` | Firebase config JSON | Firebase Console → Project Settings → General → Your apps → Config |
| `VAPID_KEY` | Web push VAPID key | Firebase Console → Project Settings → Cloud Messaging → Web Push certificates |

## How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret from the table above

## Workflow Behavior

### On Push to `main`
- Builds the frontend app
- Builds Cloud Functions
- Deploys everything to Firebase (Hosting, Functions, Firestore Rules, Storage Rules)

### On Pull Request
- Builds the frontend app
- Creates a preview deployment URL (comment added to PR)

## Manual Deployment

You can trigger a manual deployment from the **Actions** tab → **Deploy to Firebase** → **Run workflow**.

## Local Testing

Before pushing, test your build locally:

```bash
# Frontend
npm run build

# Functions
cd functions
npm run build
```

## Troubleshooting

- **Build fails**: Check environment variables are set correctly
- **Deploy fails**: Verify `FIREBASE_SERVICE_ACCOUNT` has correct permissions
- **Functions fail**: Ensure Node.js version matches (18)
