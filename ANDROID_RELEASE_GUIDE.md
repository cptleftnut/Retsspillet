# Retsspillet – Android & Cross-Platform Release Guide

Dette dokument beskriver, hvordan **Retsspillet** kan bygges, udgives til GitHub og pakkes som en officiel Android APK (eller TWA / PWA) til Android enheder samt spilles på PC/Mac via moderne webbrowsere.

---

## 1. Cross-Platform Arkitektur
Retsspillet er bygget som en responsiv Next.js Progressive Web App (PWA) med WebGL (Three.js) 3D-retssal.
- **PC / Mac**: Spilles direkte i Google Chrome, Safari, Firefox eller Edge i fuldskærms "standalone" oplevelse.
- **Android / Tablet**: Understøtter fuld touch-navigation,fuld-dupleks stemme-indtalt procedure, PWA "Tilføj til startskærm" og indbygget APK-pakkefunktion.

---

## 2. Opsætning til GitHub & CI/CD
1. Opret et nyt repository på GitHub.
2. Push kildekoden til repository:
   ```bash
   git init
   git add .
   git commit -m "Initial release: Retsspillet v1.0"
   git branch -M main
   git remote add origin https://github.com/dIT-brugernavn/retsspillet.git
   git push -u origin main
   ```

---

## 3. Bygning til Android APK (via Capacitor)
For at konvertere webappen til en native Android APK-fil, der kan installeres direkte på Android-telefoner eller udgives til Google Play Store:

1. **Installer Capacitor CLI & Android pakker**:
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init Retsspillet com.retsspillet.app --web-dir .next
   npm install @capacitor/android
   npx cap add android
   ```

2. **Byg produktionseksekveren**:
   ```bash
   npm run build
   npx cap sync
   ```

3. **Åbn Android Studio og generér APK**:
   ```bash
   npx cap open android
   ```
   * I Android Studio: Vælg **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   * Den færdige `app-debug.apk` eller `app-release.apk` findes i `android/app/build/outputs/apk/`.

---

## 4. PWA "Tilføj til startskærm" (Android Chrome / iOS Safari)
Brugere kan også installere spillet direkte fra browseren uden at downloade en APK:
- Åbn spillets URL på Android (Chrome) eller iPhone (Safari).
- Klik på **"Installér app"** i spillets topmenu eller browserens menu ("Tilføj til startskærm").
