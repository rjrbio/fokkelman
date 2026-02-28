# 🔒 Security Configuration

## ⚠️ IMPORTANT - Before deploying

This project contains **sensitive configuration** that must be protected before making it public.

## 📋 Sensitive Files

The following file contains **real credentials** and should **NOT** be committed to public repositories:

- `js/config.env.js` ← Contains real passwords and API keys

## 🛡️ Setup for Public Repository

### Option 1: Use Environment Variables (Recommended for production)

1. **Don't commit `js/config.env.js`** - Add it to `.gitignore`
2. Configure environment variables in your hosting platform (Netlify, Vercel, etc.)
3. Update the code to read from environment variables

### Option 2: Template Configuration (For demonstration)

1. Keep only `.env.example` in the repository
2. Users clone and create their own `js/config.env.js` from the template
3. Add `js/config.env.js` to `.gitignore`

## 🔧 Current Configuration Files

- ✅ `.env.example` - Safe template with example values
- ❌ `js/config.env.js` - **CONTAINS REAL CREDENTIALS** - Keep private
- ✅ `js/auth.js` - Now reads from config.env.js
- ✅ `js/firebase-config.js` - Now reads from config.env.js
- ✅ `js/config.js` - Now reads from config.env.js

## 📝 For Portfolio/Public Version

If you want to showcase this project publicly:

1. **Remove real credentials** from all files
2. Use placeholder values in code examples
3. Document the configuration process in README
4. Add screenshots instead of live demo (if credentials can't be public)

## 🔑 Credentials to Protect

- Password: Family access password
- Firebase API Key and configuration
- Cloudinary Cloud Name and Upload Preset

## ✅ Before Pushing to Public GitHub

```bash
# 1. Add config.env.js to .gitignore
echo "js/config.env.js" >> .gitignore

# 2. Remove from git history if already committed
git rm --cached js/config.env.js

# 3. Commit the changes
git add .gitignore
git commit -m "feat: Add environment configuration security"
```
