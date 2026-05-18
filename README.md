# ElijahBot — Personal Master App

**Private installable Android/iOS app containing Elijah Purcell's whole app suite.**
**Distributed as APK directly to him + close-friend testers. Never on any app store.**

---

## What this is

The Vercel hub (`elijahbot-tools-hub` repo, deployed at tools.purcellventures.co) hosts the lightweight HTML tools as URLs anyone can visit.

THIS app is different:

- A **native Android/iOS app** built with Expo
- Lists every app Elijah has ever shipped — HTML tools, Prayer Walk web sandbox, ElijahBot Refresh, Purcell Ventures, future native apps
- Each tile opens the app inside a full-screen WebView (for web apps) or deep-links to the native install (for native apps)
- **Password-locked** at launch (30-day unlock TTL stored in AsyncStorage)
- Installed via APK side-load OR TestFlight invite. NOT on Play Store or App Store.

Think of it as Elijah's personal app store of his own work.

## Why not just use the PWA?

The Vercel PWA covers ~80% of the use case. But:

- Native APK doesn't depend on the user remembering to "Add to Home Screen"
- Native WebView has better offline behavior than PWA service workers on iOS
- Native shell allows future features that PWAs can't: push notifications without permission complexity, deeplink launching of other installed apps, integrated camera/biometric unlock if wanted later

The PWA is the public-facing easy-install path. This is the personal+tester deep-install path.

## How Elijah ships it

### One-time setup

1. `cd ~/elijahbot-app`
2. `npm install` (installs Expo SDK 54, react-native-webview, async-storage, expo-crypto)
3. `npx expo install --check` (verifies versions)

### Initialize EAS (one-time)

4. `npx eas-cli login` (use existing elijahbear account)
5. `npx eas-cli init` (creates the EAS project — paste the printed projectId into `app.json` extra.eas.projectId)

### Build a preview APK (15-30 min remote build)

6. `npx eas-cli build --platform android --profile preview`
7. EAS dashboard at https://expo.dev/accounts/elijahbear/projects/elijahbot-app/builds shows the build progress
8. Download the APK when done
9. Side-load on his phone (drag to file manager OR use ADB)

### Distribute to testers

Two options:

**A) Internal distribution via EAS** (recommended)
- `npx eas-cli build --platform android --profile preview` already produces an internal distribution APK
- Send the EAS install URL directly to each tester. They open it on their phone, tap install.

**B) Direct APK file share**
- Just send each tester the .apk file via Telegram / Drive / email
- They side-load it (need to enable "Install from Unknown Sources")

### Update the app

When Elijah changes the apps list (App.tsx) or wants to add new tools:

1. Edit `App.tsx` — update the APPS array
2. Bump version in `app.json`
3. `npx eas-cli build --platform android --profile preview`
4. Send the new APK to testers
5. They install over the old version (data preserved)

## Security note

The password gate uses SHA-256 client-side. Default password is `purcell` —
**CHANGE BEFORE distributing**.

To change:
1. Pick your new password (e.g., `mountainsong-2026`)
2. Generate the hash:
   ```
   node -e "require('crypto').createHash('sha256').update('mountainsong-2026').digest('hex')"
   ```
3. Replace `PASSWORD_HASH` in App.tsx with the new hash
4. Rebuild + redistribute the APK

This is not bank-grade security (the APK can be decompiled). It's enough to keep casual users out and require you to share the password explicitly.

## What's in the apps list

Synced with the Vercel hub:

- **8 Faith + Discipline** tools (Verse Vault, Prayer Journal, Examen, Counter, Worship Set, Sermon Notes, Solomon, Calvinism Test)
- **9 Productivity + Growth** tools (Decision Journal, Brag Doc, Friendship Map, Future Self, Rival, Momentum, Reading Log, Weekly Skill, Wisdom Prep)
- **3 Business + Lead-gen** tools (AI Readiness, AI Cost Calc, AI Will)
- **3 UA + Planning** tools (Milestone, Dorm Pack, Day Sheet)
- **3 Connection + Story** tools (Echo, Hangout, Era)
- **1 Cryptography** tool (Cipher Lab)
- **3 Companion Apps** (ElijahBot Refresh, Prayer Walk web, Purcell Ventures)

Total: **30 entries**

When new tools ship to the Vercel hub, add the entry to `App.tsx APPS array` + rebuild.

## Future enhancements (v0.2+)

- Push notifications via Expo Notifications (per-tool subscription)
- Biometric unlock (FaceID/TouchID) in addition to password
- App icon badges for "new" tools shipped this week
- Native Prayer Walk integration (right now it's a separate APK, could become an embedded native screen)
- Offline-first caching layer (currently the WebViews need network for first load)

## Workshop provenance

Built 2026-05-18 workshop block in response to Elijah's request for "a master
app I could publish or download on my own that could contain all the other apps."

Companion to:
- `~/elijahbot-tools-hub/` (the Vercel-deployed HTML hub the WebViews point to)
- `~/.claude/elijahbot/drafts/instagram-marketing-posts-2026-05-18.md` (marketing for the public-facing versions)

Co-authored by ElijahBot (Claude Opus 4.7).
