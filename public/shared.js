// ═══════════════════════════════════════════════
//  Socialtree — shared.js
//  Firebase (Auth + Firestore) + icons + utilities
// ═══════════════════════════════════════════════

// ──────────────────────────────────────────────
//  FIREBASE CONFIG
// ──────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAtRjAiDBebya-f9IzQUnKPmNxoVle6J34",
  authDomain:        "socialtree-web.firebaseapp.com",
  projectId:         "socialtree-web",
  storageBucket:     "socialtree-web.firebasestorage.app",
  messagingSenderId: "916898496914",
  appId:             "1:916898496914:web:4b0a7a63332034d36e014b"
};

// ── Firebase SDK (loaded via CDN in each HTML file) ──
let _app, _auth, _db;

function firebaseInit() {
  if (_app) return;
  _app  = firebase.initializeApp(FIREBASE_CONFIG);
  _auth = firebase.auth();
  _db   = firebase.firestore();
}

// ── AUTH helpers ──
const Auth = {
  init: firebaseInit,

  onStateChange(cb) {
    firebaseInit();
    return firebase.auth().onAuthStateChanged(cb);
  },

  async signUp(email, password) {
    firebaseInit();
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  },

  async signIn(email, password) {
    firebaseInit();
    return firebase.auth().signInWithEmailAndPassword(email, password);
  },

  async signOut() {
    firebaseInit();
    await firebase.auth().signOut();
    window.location.href = 'login.html';
  },

  currentUser() {
    return firebase.auth().currentUser;
  }
};

// ── FIRESTORE helpers ──
// Collection: pages/{pageId}
// Fields: userId, name, slug, bio, theme, avatarEmoji, avatarDataUrl,
//         links (array), isPublished, vercelUrl, createdAt, updatedAt
const DB = {
  // Get all pages for current user, newest first
  async getMyPages(userId) {
    firebaseInit();
    // NOTE: no .orderBy() here — that would require a composite index.
    // We sort client-side by createdAt instead.
    const snap = await firebase.firestore()
      .collection('pages')
      .where('userId', '==', userId)
      .get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort newest first — handle both Firestore Timestamp and plain objects
    docs.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? b.createdAt?.seconds ?? 0;
      return tb - ta;
    });
    return docs;
  },

  // Get single page by Firestore ID
  async getPage(pageId) {
    firebaseInit();
    const doc = await firebase.firestore().collection('pages').doc(pageId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  // Get page by slug (for public view)
  async getBySlug(slug) {
    firebaseInit();
    const snap = await firebase.firestore()
      .collection('pages')
      .where('slug', '==', slug)
      .where('isPublished', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  },

  // Create new page
  async createPage(data) {
    firebaseInit();
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const ref = await firebase.firestore().collection('pages').add({
      ...data,
      isPublished: false,
      vercelUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  },

  // Update existing page
  async updatePage(pageId, data) {
    firebaseInit();
    await firebase.firestore().collection('pages').doc(pageId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  // Delete page
  async deletePage(pageId) {
    firebaseInit();
    await firebase.firestore().collection('pages').doc(pageId).delete();
  },

  // Check if slug is taken — wrapped in try/catch so a permissions
  // error on the public query doesn't block page creation
  async slugTaken(slug, excludeId = null) {
    firebaseInit();
    try {
      const snap = await firebase.firestore()
        .collection('pages')
        .where('slug', '==', slug)
        .limit(10)
        .get();
      return snap.docs.some(d => d.id !== excludeId);
    } catch (e) {
      console.warn('slugTaken query skipped:', e.message);
      return false; // let Firestore rules be the safety net
    }
  }
};

// ──────────────────────────────────────────────
//  SVG SOCIAL ICONS
// ──────────────────────────────────────────────
const ICONS = {
  twitter:   { name: 'X / Twitter', color: '#000000', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
  instagram: { name: 'Instagram',   color: '#E1306C', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>` },
  linkedin:  { name: 'LinkedIn',    color: '#0A66C2', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>` },
  github:    { name: 'GitHub',      color: '#24292f', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>` },
  youtube:   { name: 'YouTube',     color: '#FF0000', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
  tiktok:    { name: 'TikTok',      color: '#000000', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.29 6.29 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>` },
  facebook:  { name: 'Facebook',    color: '#1877F2', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>` },
  discord:   { name: 'Discord',     color: '#5865F2', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>` },
  twitch:    { name: 'Twitch',      color: '#9146FF', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>` },
  pinterest: { name: 'Pinterest',   color: '#E60023', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>` },
  spotify:   { name: 'Spotify',     color: '#1DB954', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>` },
  behance:   { name: 'Behance',     color: '#0057ff', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.938 4.503c.702 0 1.34.06 1.92.188.577.13 1.07.33 1.485.61.41.28.733.65.96 1.12.225.47.34 1.05.34 1.73 0 .74-.17 1.36-.507 1.86-.338.49-.837.9-1.502 1.22.906.26 1.576.72 2.022 1.37.448.66.665 1.45.665 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-.16 1.35-.49.36-1.06.62-1.7.78-.63.17-1.3.25-2.01.25H0V4.51h6.938v-.007zM16.94 9.557c1.012 0 1.926.22 2.74.66.817.44 1.46 1.12 1.927 2.04.468.92.7 2.04.7 3.36H14c.04.876.324 1.538.854 1.98.527.44 1.168.66 1.923.66.82 0 1.468-.212 1.94-.638.477-.424.757-.883.842-1.38h2.64c-.156.766-.455 1.46-.9 2.082-.445.62-.99 1.1-1.632 1.44-.643.34-1.334.51-2.073.51-1.26 0-2.29-.37-3.086-1.11-.797-.74-1.195-1.78-1.195-3.12 0-1.32.39-2.37 1.168-3.15.78-.78 1.81-1.17 3.088-1.32l.368-.01zM16.84 11.44c-.672 0-1.24.2-1.708.6-.47.4-.744.96-.822 1.68h5.02c-.04-.67-.26-1.22-.666-1.64-.404-.42-.99-.64-1.822-.64zm-10.78-4.7H3v2.73h3.084c1.28 0 1.917-.47 1.917-1.42 0-.484-.155-.83-.468-1.04-.31-.21-.782-.27-1.47-.27zM16.17 7h4.51v1.316h-4.51V7zM6.584 15.494H3v3.035h3.578c1.39 0 2.085-.55 2.085-1.64 0-.55-.17-.97-.51-1.26-.34-.29-.878-.135-1.568-.135z"/></svg>` },
  dribbble:  { name: 'Dribbble',    color: '#EA4C89', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.017-8.04 6.4 1.73 1.358 3.92 2.166 6.29 2.166 1.42 0 2.77-.29 4-.816zm-11.62-2.073c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.855zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.176zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.12 0-.24.003-.4.008zm9.773 2.9c-.2.269-1.882 2.476-5.693 4.016.24.49.47.985.68 1.486.08.18.15.36.22.54 3.394-.43 6.77.257 7.1.33-.03-2.287-.87-4.38-2.307-6.373z"/></svg>` },
  medium:    { name: 'Medium',      color: '#000000', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg>` },
  substack:  { name: 'Substack',    color: '#FF6719', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg>` },
  threads:   { name: 'Threads',     color: '#000000', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 012.325.156l-.07-.33c-.198-.944-.687-1.58-1.493-1.94-.367-.163-.78-.25-1.226-.263-.81-.021-1.624.176-2.234.533l-.914-1.782c.84-.493 1.99-.797 3.19-.762.716.02 1.392.16 2.01.417 1.355.556 2.208 1.685 2.507 3.268.048.25.085.51.108.773.57.306 1.077.66 1.514 1.062 1.083.988 1.796 2.305 1.98 3.838.32 2.698-.64 4.947-2.714 6.548-1.832 1.415-4.096 2.127-6.937 2.159z"/></svg>` },
  bluesky:   { name: 'Bluesky',     color: '#0085ff', svg: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 01-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>` },
  website:   { name: 'Website',     color: '#555555', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>` },
  email:     { name: 'Email',       color: '#555555', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>` },
  link:      { name: 'Custom Link', color: '#777777', svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>` },
};

const ICON_ORDER = [
  'twitter','instagram','linkedin','github','youtube','tiktok',
  'facebook','discord','twitch','pinterest','spotify','behance',
  'dribbble','medium','substack','threads','bluesky','website','email','link'
];

/** Return SVG string with given size and color injected */
function svgWith(id, size = 18, color) {
  const ic = ICONS[id] || ICONS.link;
  const c = color || ic.color;
  return ic.svg
    .replace(/currentColor/g, c)
    .replace('<svg ', `<svg width="${size}" height="${size}" `);
}

// ──────────────────────────────────────────────
//  URL FIXER — ensures links always have a protocol
//  Handles: "github.com/x" → "https://github.com/x"
//           "http://..."   → kept as-is
//           ""             → "#"
// ──────────────────────────────────────────────
function ensureUrl(url) {
  if (!url || !url.trim()) return '#';
  const u = url.trim();
  // Already has a protocol
  if (/^https?:\/\//i.test(u)) return u;
  // mailto: / tel: — keep as-is
  if (/^(mailto:|tel:)/i.test(u)) return u;
  // Everything else — prepend https://
  return 'https://' + u;
}

// ──────────────────────────────────────────────
//  HTML GENERATOR  (used in editor + publish)
// ──────────────────────────────────────────────
function generatePageHTML(page) {
  const THEMES = {
    blush:    { bg: 'linear-gradient(135deg,#fff5f2,#fce8e0)', card: 'rgba(244,217,208,0.55)' },
    mint:     { bg: 'linear-gradient(135deg,#f2fbf5,#d9f0e2)', card: 'rgba(208,232,216,0.55)' },
    lavender: { bg: 'linear-gradient(135deg,#f5f2ff,#e6dffa)', card: 'rgba(221,212,240,0.55)' },
    butter:   { bg: 'linear-gradient(135deg,#fffbf0,#f8edcc)', card: 'rgba(245,237,204,0.55)' },
    sky:      { bg: 'linear-gradient(135deg,#f0f8ff,#d0e8f8)', card: 'rgba(204,228,240,0.55)' },
    white:    { bg: '#ffffff',                                  card: '#f0ece8' },
  };
  const t = THEMES[page.theme] || THEMES.blush;

  const avatarHTML = page.avatarDataUrl
    ? `<div class="avatar"><img src="${page.avatarDataUrl}" alt="avatar"></div>`
    : `<div class="avatar"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="1.4" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

  const linksHTML = (page.links || []).map(l => {
    const ic  = ICONS[l.iconId] || ICONS.link;
    const svg = ic.svg
      .replace(/currentColor/g, ic.color)
      .replace('<svg ', `<svg width="18" height="18" `);
    const safeUrl   = ensureUrl(l.url).replace(/"/g, '%22');
    const safeLabel = (l.label || 'Link').replace(/</g, '&lt;');
    const hasUrl    = !!(l.url && l.url.trim());
    return `    <a href="${safeUrl}" class="link-btn"${hasUrl ? ' target="_blank" rel="noopener"' : ''}>
      <span class="link-icon" style="color:${ic.color}">${svg}</span>
      <span class="link-title">${safeLabel}</span>
      <span class="link-arrow">↗</span>
    </a>`;
  }).join('\n');

  const safeName = (page.name || 'My Links').replace(/</g, '&lt;');
  const safeBio  = (page.bio  || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeName} — links</title>
<meta property="og:title" content="${safeName}">
<meta name="description" content="${safeBio}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;background:${t.bg};padding:3rem 1rem 2rem}
.container{width:100%;max-width:400px;display:flex;flex-direction:column;align-items:center;animation:up .5s ease}
@keyframes up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.avatar{width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,.6);margin-bottom:1rem;display:flex;align-items:center;justify-content:center;font-size:2.2rem;border:3px solid rgba(255,255,255,.8);box-shadow:0 2px 16px rgba(0,0,0,.08);overflow:hidden;flex-shrink:0}
.avatar img{width:100%;height:100%;object-fit:cover}
.name{font-family:'Instrument Serif',serif;font-size:1.5rem;margin-bottom:.35rem;color:#2d2d2d;text-align:center}
.bio{font-size:.82rem;color:#888;text-align:center;line-height:1.6;max-width:280px;margin-bottom:1.75rem}
.links{width:100%;display:flex;flex-direction:column;gap:.65rem}
.link-btn{display:flex;align-items:center;gap:.7rem;padding:.85rem 1.1rem;border-radius:14px;background:${t.card};text-decoration:none;color:#2d2d2d;font-size:.88rem;font-weight:500;transition:transform .18s,box-shadow .18s;border:1px solid rgba(255,255,255,.6)}
.link-btn:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.1)}
.link-icon{flex-shrink:0;display:flex;align-items:center}
.link-icon svg{width:18px;height:18px}
.link-title{flex:1}
.link-arrow{font-size:.75rem;opacity:.35}
.footer{margin-top:2.5rem;font-size:.68rem;color:#aaa;opacity:.7}
.footer a{color:inherit}
</style>
</head>
<body>
<div class="container">
  ${avatarHTML}
  <div class="name">${safeName}</div>
  <div class="bio">${safeBio}</div>
  <div class="links">
${linksHTML}
  </div>
  <div class="footer">made with <a href="https://social-tree-self.vercel.app" target="_blank">Socialtree</a></div>
</div>
</body>
</html>`;
}

// ──────────────────────────────────────────────
//  UTILITIES
// ──────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    '':      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>',
  };
  el.innerHTML = (icons[type] || icons['']) + `<span>${msg}</span>`;
  el.className = ['show', type ? `t-${type}` : ''].filter(Boolean).join(' ');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ''; }, 3200);
}

function genId() {
  return '_' + Math.random().toString(36).slice(2, 9);
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function $(id) { return document.getElementById(id); }
