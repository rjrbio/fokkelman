# Galería Familiar Fokkelman

A family photo gallery with personalized journeys, memory management, and cloud synchronization.

## ✨ Features

- **Photo Gallery** with pagination (50 photos per page)
- **Password authentication** system
- **Custom Journey** to save favorite photos with descriptions, dates, and locations
- **Memory Album** displaying all journey photos with saved memories
- **Firebase sync** across all family member devices
- **Upload custom photos** that everyone can see
- **Classic and elegant design** optimized for elderly users
- **Vintage color palette** (brown, cream, gold, sage green)

## 🚀 Technologies

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Image Storage**: Cloudinary
- **Database**: Firebase Firestore
- **Hosting**: Netlify-ready

## 📁 Project Structure

```
fokkelman/
├── index.html          # Home page with family letters
├── galeria.html        # Gallery with pagination
├── recorrido.html      # Journey navigation
├── album.html          # Album grid view with add photo feature
├── css/
│   └── styles.css      # Main styles with vintage theme
├── js/
│   ├── config.env.js   # Environment configuration (NOT IN REPO - create from .env.example)
│   ├── auth.js         # Authentication system
│   ├── config.js       # Cloudinary configuration
│   ├── firebase-config.js  # Firebase configuration
│   ├── photo-manager.js    # Photo and journey management
│   ├── photo-loader.js     # Photo loading from JSON
│   ├── storage.js      # localStorage management
│   └── lightbox.js     # Image viewer
├── .env.example        # Example environment variables
├── fotos.json          # Photo index (3659+ photos)
└── netlify.toml        # Deployment configuration
```

## 🔒 Setup & Configuration

**⚠️ Important**: This project requires configuration before running.

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/fokkelman-gallery.git
   cd fokkelman-gallery
   ```

2. **Create configuration file**
   ```bash
   # Copy the example configuration
   cp .env.example js/config.env.js
   ```

3. **Configure credentials**
   - Edit `js/config.env.js` with your real values
   - See [CONFIGURATION.md](CONFIGURATION.md) for detailed instructions

4. **Open in browser**
   ```bash
   # Simply open index.html in your browser
   open index.html
   ```

### Required Configuration

You need to set up:
- Family password for access
- Firebase project (for data sync)
- Cloudinary account (for image hosting)

See [CONFIGURATION.md](CONFIGURATION.md) for step-by-step setup guide.

## 🔐 Security

This project contains sensitive configuration that must be protected:
- Password authentication
- Firebase API keys
- Cloudinary credentials

**The file `js/config.env.js` contains real credentials and is excluded from the repository.**

See [SECURITY.md](SECURITY.md) for security best practices.

## 📖 How It Works

1. **Gallery**: Browse all family photos (paginated)
2. **Journey**: Select photos to add to your personal journey
3. **Journey Page**: Add memories, dates, and locations to each photo
4. **Album**: View all saved memories - photos with information automatically appear here
5. **Upload**: Family members can upload new photos to share with everyone

## 🎨 Design

- **Vintage color palette**: Warm browns, cream, sage green, dusty blue, soft gold
- **Typography**: Georgia serif for classic feel
- **Responsive**: Works on desktop, tablet, and mobile
- **Accessibility**: Large buttons and text for elderly users

## 🚀 Deployment

The project is ready for deployment on:
- Netlify (configuration included)
- Vercel
- GitHub Pages
- Any static hosting

## 📝 License

Private family project - All rights reserved

---

*Created with ❤️ for the Fokkelman Family - January 2026*
