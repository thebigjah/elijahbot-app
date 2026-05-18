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

const APPS: AppEntry[] = [
  // === TIER 1 — APPS (deserve native dev arc, marketing as standalone products) ===
  { id: 'echo', name: 'Echo', description: 'Guided life-story interview · multi-session workflow · printable artifact', url: `${HUB_BASE}/echo/`, category: 'Apps', icon: '👴', tier: 'app' },
  { id: 'counter-argument', name: 'Counter', description: 'Apologetics practice · 12 topics · answer-first discipline + expert reveal', url: `${HUB_BASE}/counter-argument/`, category: 'Apps', icon: '⚖️', tier: 'app' },
  { id: 'decision-journal', name: 'Decision Journal', description: 'Annie Duke calibration · review-date push reminders · multi-year practice', url: `${HUB_BASE}/decision-journal/`, category: 'Apps', icon: '🎯', tier: 'app' },
  { id: 'verse-vault', name: 'Verse Vault', description: 'Scripture memorization · 5-level progressive hide · spaced repetition (planned)', url: `${HUB_BASE}/verse-vault/`, category: 'Apps', icon: '📖', tier: 'app' },
  { id: 'friendship-map', name: 'Friendship Map', description: 'Personal CRM by tier · push when overdue · contact integration (planned)', url: `${HUB_BASE}/friendship-map/`, category: 'Apps', icon: '🤝', tier: 'app' },
  { id: 'prayer-journal', name: 'Prayer Journal', description: 'Multi-year ACTS journaling · answered-prayer log · encrypted backup (planned)', url: `${HUB_BASE}/prayer-journal/`, category: 'Apps', icon: '🙏', tier: 'app' },
  { id: 'worship-set', name: 'Worship Set', description: 'Multi-set library · band collaboration (planned) · BPM + key flow viz', url: `${HUB_BASE}/worship-set/`, category: 'Apps', icon: '🎵', tier: 'app' },

  // === TIER 2 — TOOLS (single-screen utilities, no native version needed) ===

  // -- Faith + Devotional --
  { id: 'examen', name: 'Examen', description: 'Ignatian end-of-day prayer in 5 movements', url: `${HUB_BASE}/examen/`, category: 'Faith Tools', icon: '🕯️', tier: 'tool' },
  { id: 'sermon-notes', name: 'Sermon Notes', description: 'Sunday note capture + stats panel', url: `${HUB_BASE}/sermon-notes/`, category: 'Faith Tools', icon: '📝', tier: 'tool' },
  { id: 'solomon', name: 'Solomon', description: 'Daily wisdom quote rotation', url: `${HUB_BASE}/solomon/`, category: 'Faith Tools', icon: '💎', tier: 'tool' },
  { id: 'calvinism-test', name: 'Calvinism Test', description: 'TULIP self-assessment', url: `${HUB_BASE}/calvinism-test/`, category: 'Faith Tools', icon: '🌷', tier: 'tool' },

  // -- Personal Growth --
  { id: 'brag-doc', name: 'Brag Doc', description: 'Wins log + dark-day shuffler', url: `${HUB_BASE}/brag-doc/`, category: 'Personal Growth Tools', icon: '🏆', tier: 'tool' },
  { id: 'future-self', name: 'Future Self', description: 'Sealed letters with date-locked release', url: `${HUB_BASE}/future-self/`, category: 'Personal Growth Tools', icon: '✉️', tier: 'tool' },
  { id: 'rival', name: 'Rival', description: 'Self-competition metric tracker', url: `${HUB_BASE}/rival/`, category: 'Personal Growth Tools', icon: '⚔️', tier: 'tool' },
  { id: 'momentum', name: 'Momentum', description: 'One intention a day + scripture + heatmap', url: `${HUB_BASE}/momentum/`, category: 'Personal Growth Tools', icon: '🌅', tier: 'tool' },
  { id: 'reading-log', name: 'Reading Log', description: 'Personal Goodreads — local only', url: `${HUB_BASE}/reading-log/`, category: 'Personal Growth Tools', icon: '📚', tier: 'tool' },
  { id: 'weekly-skill', name: 'Weekly Skill', description: 'New fun skill each ISO week', url: `${HUB_BASE}/weekly-skill/`, category: 'Personal Growth Tools', icon: '🎓', tier: 'tool' },
  { id: 'wisdom-prep', name: 'Wisdom Prep', description: '5-min mentor conversation prep', url: `${HUB_BASE}/wisdom-prep/`, category: 'Personal Growth Tools', icon: '🧠', tier: 'tool' },

  // -- Business + Lead-gen --
  { id: 'ai-readiness-test', name: 'AI Readiness Test', description: '10-question SMB diagnostic', url: `${HUB_BASE}/ai-readiness-test/`, category: 'Business Tools', icon: '📊', tier: 'tool' },
  { id: 'ai-cost-calculator', name: 'AI Cost Calculator', description: 'Interactive ROI for automation', url: `${HUB_BASE}/ai-cost-calculator/`, category: 'Business Tools', icon: '💰', tier: 'tool' },
  { id: 'ai-will', name: 'AI Will', description: '30-min business continuity interview', url: `${HUB_BASE}/ai-will/`, category: 'Business Tools', icon: '🏢', tier: 'tool' },

  // -- UA + Planning --
  { id: 'milestone', name: 'Milestone', description: 'Visual countdown grid of upcoming events', url: `${HUB_BASE}/milestone/`, category: 'UA + Planning Tools', icon: '⏳', tier: 'tool' },
  { id: 'dorm-pack', name: 'Dorm Pack', description: 'UA move-in packing checklist', url: `${HUB_BASE}/dorm-pack/`, category: 'UA + Planning Tools', icon: '📦', tier: 'tool' },
  { id: 'day-sheet', name: 'Day Sheet', description: 'Printable daily planner', url: `${HUB_BASE}/day-sheet/`, category: 'UA + Planning Tools', icon: '📅', tier: 'tool' },

  // -- Connection + Story --
  { id: 'hangout', name: 'Steal My Hangout', description: '20 Atlanta hangout ideas mapped', url: `${HUB_BASE}/hangout/`, category: 'Connection Tools', icon: '🍽️', tier: 'tool' },
  { id: 'era', name: 'Era', description: 'Step into a historical year — 12 years curated', url: `${HUB_BASE}/era/`, category: 'Connection Tools', icon: '🕰️', tier: 'tool' },

  // -- Cryptography --
  { id: 'cipher-lab', name: 'Cipher Lab', description: '6 classical ciphers + puzzle hunt builder', url: `${HUB_BASE}/cipher-lab/`, category: 'Cryptography Tools', icon: '🔐', tier: 'tool' },

  // === TIER 3 — COMPANION APPS (live at their own URLs/installs) ===
  { id: 'elijahbot-refresh', name: 'ElijahBot Refresh', description: 'Personal accountability chatbot · Google sign-in · live in production', url: 'https://elijahbot-refresh.vercel.app', category: 'Companion Apps', icon: '🔄', tier: 'companion' },
  { id: 'coverage', name: 'Prayer Walk (web)', description: 'GPS-tracked walks · web sandbox · iOS Safari compatible', url: 'https://coverage-bice.vercel.app', category: 'Companion Apps', icon: '🚶', tier: 'companion' },
  { id: 'purcell-ventures', name: 'Purcell Ventures', description: 'The business front door · 4 service divisions · consulting bookings', url: 'https://purcellventures.co', category: 'Companion Apps', icon: '🏢', tier: 'companion' },
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
