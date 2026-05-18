/**
 * ElijahBot — personal master app for Elijah Purcell.
 * Lists all his apps. Each tile opens a full-screen WebView for the deployed URL.
 * Password-gated. Not on any app store. Distributed as APK to him + close-friend testers.
 *
 * Built 2026-05-18 workshop block.
 */

import { StatusBar } from 'expo-status-bar';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

// === CONFIG =====================================================
// IMPORTANT: change PASSWORD_HASH before sharing the APK with anyone.
// Default is sha256("purcell"). To generate a new hash, in any browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-pw'))
//     .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('')))
const PASSWORD_HASH = 'e685b6be40952e8daf6c8aa347815677ff53c54f4bf6fdbd29307542ddec636e';
const UNLOCK_TTL_DAYS = 30;
const UNLOCK_KEY = '@elijahbot-app/unlocked';

// Replace these with `tools.purcellventures.co` once the Vercel custom domain is wired.
// For now, point at the production Vercel deploy URL (elijahbot-tools-hub.vercel.app).
const HUB_BASE = 'https://elijahbot-tools-hub.vercel.app';

// === APPS LIST =================================================
// Add new ones here. WebView opens the URL inside the app.
// Native deeplinks (intent: / itms-apps://) handled in onShouldStartLoadWithRequest.
type AppEntry = {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  icon: string; // single emoji or short text
  // tier: 'app' = full workflow product (deserves native dev). 'tool' = single-screen utility.
  // 'companion' = lives at its own URL/install.
  tier: 'app' | 'tool' | 'companion';
};

// MASTER APP CONTENTS: only Elijah's actual apps. Tools live on the Vercel hub website.
// Per Elijah's directive 2026-05-18: "I want all of those to be their own apps someday
// and the master app is just to be a center for that. only keep my actual apps in the
// master app and the rest of the tools go on the website."
const APPS: AppEntry[] = [
  // === THE APPS (each will become its own standalone someday; master app is the hub) ===
  { id: 'echo', name: 'Echo', description: 'Guided life-story interview · 60 questions across 9 chapters · generates printable life document', url: `${HUB_BASE}/echo/`, category: 'Apps', icon: '👴', tier: 'app' },
  { id: 'hangout', name: 'Steal My Hangout', description: 'Hangout ideas browsable + mapped · roll the dice · share lists with friends', url: `${HUB_BASE}/hangout/`, category: 'Apps', icon: '🍽️', tier: 'app' },
  { id: 'momentum', name: 'Momentum', description: 'One intention per day · scripture rotation · 365-day heatmap · witness not compete', url: `${HUB_BASE}/momentum/`, category: 'Apps', icon: '🌅', tier: 'app' },
  { id: 'rival', name: 'Rival', description: 'Self-competition metric tracker · daily logging · sparklines + heatmaps', url: `${HUB_BASE}/rival/`, category: 'Apps', icon: '⚔️', tier: 'app' },
  { id: 'era', name: 'Era', description: 'Step into a historical year · no hindsight · 12 hand-curated years (1955-2020)', url: `${HUB_BASE}/era/`, category: 'Apps', icon: '🕰️', tier: 'app' },
  { id: 'prayer-walk', name: 'Prayer Walk', description: 'GPS-tracked prayer walks · recency heatmap · native APK (tap to install)', url: 'https://expo.dev/artifacts/eas/aT5ufmwQVBGzKhotw12GKs.apk', category: 'Apps', icon: '🚶', tier: 'app' },

  // === COMING SOON (backlog apps Elijah has scoped but not yet built) ===
  { id: 'longitude', name: 'Longitude', description: 'Slow pen-pal · message a random person your age · 1-day to 1-month delivery delay · backlogged', url: 'about:blank', category: 'Coming Soon', icon: '✉️', tier: 'app' },
  { id: 'screentime-analyzer', name: 'Screentime Analyzer', description: 'Tracks screen time + AI analysis + actionable recommendations · backlogged', url: 'about:blank', category: 'Coming Soon', icon: '📱', tier: 'app' },
  { id: 'smart-calendar', name: 'Smart Calendar', description: 'AI-context-aware calendar · click an entry → pull AI context · backlogged', url: 'about:blank', category: 'Coming Soon', icon: '📆', tier: 'app' },
  { id: 'magic-closet', name: 'Magic Closet', description: 'Wardrobe + AI outfit suggestions · Expo scaffold exists · backlogged', url: 'about:blank', category: 'Coming Soon', icon: '👔', tier: 'app' },
  { id: 'theme-park-waits', name: 'Theme Park Waits', description: 'AI-powered ride wait times · user-contributed data · backlogged', url: 'about:blank', category: 'Coming Soon', icon: '🎢', tier: 'app' },
  { id: 'pickit-app', name: 'PickIt (expanded)', description: 'Group voting app · already on Play Store · expansion roadmap', url: 'https://play.google.com/store/apps/details?id=com.purcellventures.pickit', category: 'Coming Soon', icon: '🗳️', tier: 'app' },

  // === COMPANION (live as their own deployments, kept for one-tap access) ===
  { id: 'elijahbot-refresh', name: 'ElijahBot Refresh', description: 'Personal accountability chatbot · Google sign-in · live in production', url: 'https://elijahbot-refresh.vercel.app', category: 'Companion Apps', icon: '🔄', tier: 'companion' },
  { id: 'tools-hub', name: 'Tools Hub (website)', description: 'All 27 single-file tools on the Vercel website — opens in browser', url: HUB_BASE, category: 'Companion Apps', icon: '🛠️', tier: 'companion' },
  { id: 'purcell-ventures', name: 'Purcell Ventures', description: 'The business front door · consulting bookings', url: 'https://purcellventures.co', category: 'Companion Apps', icon: '🏢', tier: 'companion' },
];

// === COMPONENTS =================================================

async function _hash(s: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    try {
      const h = await _hash(pw);
      if (h === PASSWORD_HASH) {
        await AsyncStorage.setItem(UNLOCK_KEY, JSON.stringify({ ts: Date.now() }));
        onUnlock();
      } else {
        setError('Wrong password.');
        setPw('');
      }
    } catch (e) {
      setError('Hash failed: ' + String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.lockContainer}>
      <View style={styles.lockBox}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>ElijahBot</Text>
        <Text style={styles.lockSubtitle}>Private personal app. Password required.</Text>
        <TextInput
          style={styles.lockInput}
          placeholder="Password"
          placeholderTextColor="#666"
          secureTextEntry
          autoFocus
          autoCapitalize="none"
          value={pw}
          onChangeText={setPw}
          onSubmitEditing={submit}
        />
        <Pressable style={styles.lockButton} onPress={submit} disabled={checking}>
          <Text style={styles.lockButtonText}>{checking ? '...' : 'Unlock'}</Text>
        </Pressable>
        {error ? <Text style={styles.lockError}>{error}</Text> : null}
      </View>
    </View>
  );
}

function AppGrid({ onOpen }: { onOpen: (app: AppEntry) => void }) {
  const grouped = useMemo(() => {
    const m: Record<string, AppEntry[]> = {};
    APPS.forEach(a => {
      (m[a.category] ||= []).push(a);
    });
    return m;
  }, []);

  return (
    <FlatList
      data={Object.keys(grouped)}
      keyExtractor={cat => cat}
      contentContainerStyle={{ paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ElijahBot</Text>
          <Text style={styles.headerSubtitle}>{APPS.length} apps · personal + tester build</Text>
        </View>
      }
      renderItem={({ item: cat }) => {
        const items = grouped[cat];
        const firstTier = items[0]?.tier;
        const isFeatured = firstTier === 'app';
        const isCompanion = firstTier === 'companion';
        return (
          <View>
            <Text style={[styles.sectionTitle, isFeatured && styles.sectionTitleFeatured]}>
              {cat}
              {isFeatured && <Text style={styles.sectionBadge}>  · full workflow</Text>}
              {isCompanion && <Text style={styles.sectionBadge}>  · own deployment</Text>}
            </Text>
            <View style={styles.appsRow}>
              {items.map(app => (
                <Pressable
                  key={app.id}
                  style={[styles.appCard, isFeatured && styles.appCardFeatured]}
                  onPress={() => onOpen(app)}
                >
                  <Text style={styles.appIcon}>{app.icon}</Text>
                  <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                  <Text style={styles.appDesc} numberOfLines={2}>{app.description}</Text>
                  {isCompanion && <Text style={styles.companionTag}>opens externally ↗</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        );
      }}
    />
  );
}

function AppView({ app, onClose }: { app: AppEntry; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a14' }}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.modalClose}>←  Back</Text>
          </Pressable>
          <Text style={styles.modalTitle} numberOfLines={1}>{app.name}</Text>
          <View style={{ width: 60 }} />
        </View>
        <WebView
          source={{ uri: app.url }}
          style={{ flex: 1, backgroundColor: '#0a0a14' }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          allowsBackForwardNavigationGestures
          decelerationRate="normal"
        />
        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#c2a173" />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState<boolean | null>(null); // null = loading
  const [active, setActive] = useState<AppEntry | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(UNLOCK_KEY);
        if (!raw) return setUnlocked(false);
        const { ts } = JSON.parse(raw);
        const age = Date.now() - ts;
        setUnlocked(age < UNLOCK_TTL_DAYS * 24 * 60 * 60 * 1000);
      } catch {
        setUnlocked(false);
      }
    })();
  }, []);

  if (unlocked === null) {
    return (
      <View style={[styles.lockContainer, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#c2a173" />
      </View>
    );
  }

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <AppGrid onOpen={setActive} />
      {active && <AppView app={active} onClose={() => setActive(null)} />}
    </SafeAreaView>
  );
}

// === STYLES ====================================================
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a14' },
  header: { padding: 16, paddingBottom: 8 },
  headerTitle: { color: '#c2a173', fontSize: 28, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 13, marginTop: 4 },
  sectionTitle: { color: '#888', fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  sectionTitleFeatured: { color: '#c2a173', fontSize: 14, fontWeight: '700' },
  sectionBadge: { color: '#666', fontSize: 10, fontWeight: '400' },
  appsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  appCard: { width: '48%', backgroundColor: '#14141f', borderColor: '#2a2a3a', borderWidth: 1, borderRadius: 12, padding: 12, margin: 4 },
  appCardFeatured: { borderColor: '#c2a173', backgroundColor: '#1a1a26' },
  appIcon: { fontSize: 24, marginBottom: 6 },
  appName: { color: '#e8e8ea', fontSize: 14, fontWeight: '600' },
  appDesc: { color: '#888', fontSize: 11, marginTop: 4, lineHeight: 14 },
  companionTag: { color: '#c2a173', fontSize: 9, marginTop: 6, fontStyle: 'italic' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a3a' },
  modalClose: { color: '#c2a173', fontSize: 14, width: 60 },
  modalTitle: { color: '#e8e8ea', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  loadingOverlay: { position: 'absolute', top: 60, right: 0, padding: 12 },
  lockContainer: { flex: 1, backgroundColor: '#0a0a14', alignItems: 'center', justifyContent: 'center', padding: 20 },
  lockBox: { backgroundColor: '#14141f', borderColor: '#2a2a3a', borderWidth: 1, borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  lockIcon: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  lockTitle: { color: '#e8e8ea', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  lockSubtitle: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 20, marginTop: 6 },
  lockInput: { backgroundColor: '#0a0a14', borderColor: '#2a2a3a', borderWidth: 1, borderRadius: 8, padding: 12, color: '#e8e8ea', fontSize: 15, marginBottom: 12 },
  lockButton: { backgroundColor: '#c2a173', borderRadius: 8, padding: 14, alignItems: 'center' },
  lockButtonText: { color: '#0a0a14', fontWeight: '700', fontSize: 15 },
  lockError: { color: '#c2453d', fontSize: 12, textAlign: 'center', marginTop: 12 },
});
