# 🔧 Configuration Guide

## Initial Setup

This project requires configuration before it can run. Follow these steps:

### 1. Create Configuration File

Copy the example configuration and add your real credentials:

```bash
# Create the configuration file from template
cp .env.example js/config.env.js
```

### 2. Edit `js/config.env.js`

Open the file and replace placeholder values with your real credentials:

```javascript
const ENV_CONFIG = {
    // Change this to your desired password
    PASSWORD: 'YourFamilyPassword',
    
    // Get these from Firebase Console (https://console.firebase.google.com/)
    FIREBASE_API_KEY: 'your-actual-api-key',
    FIREBASE_AUTH_DOMAIN: 'your-project.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'your-project-id',
    FIREBASE_STORAGE_BUCKET: 'your-project.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: '123456789',
    FIREBASE_APP_ID: '1:123456789:web:abc123',
    
    // Get these from Cloudinary Dashboard (https://cloudinary.com/console)
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_UPLOAD_PRESET: 'your-unsigned-preset',
    CLOUDINARY_UPLOAD_FOLDER: 'your-folder-name'
};
```

### 3. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Add a web app to your project
4. Enable Firestore Database
5. Copy the configuration values to `js/config.env.js`

### 4. Cloudinary Setup

1. Create account at [Cloudinary](https://cloudinary.com/)
2. Go to Settings → Upload
3. Create an **Unsigned** upload preset
4. Copy your Cloud Name and Preset name to `js/config.env.js`

### 5. Test Locally

Open `index.html` in a web browser and test the login with your configured password.

## ⚠️ Security Notes

- **Never commit `js/config.env.js`** to a public repository
- The file is already in `.gitignore`
- For public demos, use the example values only

## 🚀 Deployment

When deploying to production (Netlify, Vercel, etc.):

Option 1: Upload `config.env.js` directly (if private)
Option 2: Use environment variables and build process to inject values

---

For more security information, see [SECURITY.md](SECURITY.md)
