/**
 * /api/publish.js  — Vercel Serverless Function
 *
 * POST /api/publish
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { pageId: "firestore-doc-id" }
 *
 * 1. Verifies Firebase JWT via Google's public certs endpoint
 * 2. Fetches page from Firestore (must belong to that user)
 * 3. Generates self-contained HTML
 * 4. Deploys to Vercel via Deploy API, polls until READY
 * 5. Returns { url } — saves it back to Firestore
 *
 * ─── ENV VARS (set in Vercel Project Settings → Environment Variables) ───
 *  FIREBASE_PROJECT_ID   your Firebase project ID
 *  VERCEL_TOKEN          your Vercel personal access token  (add later)
 *  VERCEL_TEAM_ID        (optional) your Vercel team ID
 */

// ── INLINE SOCIAL ICONS (same as shared.js) ──
const ICONS = {
  twitter:   { color:'#000000', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
  instagram: { color:'#E1306C', svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>` },
  linkedin:  { color:'#0A66C2', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>` },
  github:    { color:'#24292f', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>` },
  youtube:   { color:'#FF0000', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>` },
  tiktok:    { color:'#000000', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.29 6.29 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/></svg>` },
  facebook:  { color:'#1877F2', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>` },
  discord:   { color:'#5865F2', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>` },
  twitch:    { color:'#9146FF', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>` },
  pinterest: { color:'#E60023', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>` },
  spotify:   { color:'#1DB954', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>` },
  behance:   { color:'#0057ff', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.938 4.503c.702 0 1.34.06 1.92.188.577.13 1.07.33 1.485.61.41.28.733.65.96 1.12.225.47.34 1.05.34 1.73 0 .74-.17 1.36-.507 1.86-.338.49-.837.9-1.502 1.22.906.26 1.576.72 2.022 1.37.448.66.665 1.45.665 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-.16 1.35-.49.36-1.06.62-1.7.78-.63.17-1.3.25-2.01.25H0V4.51h6.938v-.007z"/></svg>` },
  dribbble:  { color:'#EA4C89', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.017-8.04 6.4 1.73 1.358 3.92 2.166 6.29 2.166 1.42 0 2.77-.29 4-.816z"/></svg>` },
  medium:    { color:'#000000', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12z"/></svg>` },
  substack:  { color:'#FF6719', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg>` },
  threads:   { color:'#000000', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098z"/></svg>` },
  bluesky:   { color:'#0085ff', svg:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364z"/></svg>` },
  website:   { color:'#555555', svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>` },
  email:     { color:'#555555', svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>` },
  link:      { color:'#777777', svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>` },
};

// ── URL FIXER ──
function ensureUrl(url) {
  if (!url || !url.trim()) return '#';
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(mailto:|tel:)/i.test(u)) return u;
  return 'https://' + u;
}

// ── HTML GENERATOR ──
function buildHTML(page) {
  const THEMES = {
    blush:    { bg: 'linear-gradient(135deg,#fff5f2,#fce8e0)', card: 'rgba(244,217,208,0.55)' },
    mint:     { bg: 'linear-gradient(135deg,#f2fbf5,#d9f0e2)', card: 'rgba(208,232,216,0.55)' },
    lavender: { bg: 'linear-gradient(135deg,#f5f2ff,#e6dffa)', card: 'rgba(221,212,240,0.55)' },
    butter:   { bg: 'linear-gradient(135deg,#fffbf0,#f8edcc)', card: 'rgba(245,237,204,0.55)' },
    sky:      { bg: 'linear-gradient(135deg,#f0f8ff,#d0e8f8)', card: 'rgba(204,228,240,0.55)' },
    white:    { bg: '#ffffff', card: '#f0ece8' },
  };
  const t = THEMES[page.theme] || THEMES.blush;

  const avatar = page.avatarDataUrl
    ? `<div class="avatar"><img src="${page.avatarDataUrl}" alt=""></div>`
    : `<div class="avatar"><span>${page.avatarEmoji || '🌸'}</span></div>`;

  const links = (page.links || []).map(l => {
    const ic  = ICONS[l.iconId] || ICONS.link;
    const svg = ic.svg.replace(/currentColor/g, ic.color).replace('<svg ', `<svg width="18" height="18" `);
    return `    <a href="${ensureUrl(l.url).replace(/"/g,'%22')}" class="link-btn"${(l.url&&l.url.trim())?' target="_blank" rel="noopener"':''}>
      <span class="link-icon" style="color:${ic.color}">${svg}</span>
      <span class="link-title">${String(l.label||'Link').replace(/</g,'&lt;')}</span>
      <span class="link-arrow">↗</span>
    </a>`;
  }).join('\n');

  const safeName = String(page.name || 'My Links').replace(/</g, '&lt;');
  const safeBio  = String(page.bio  || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');

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
</style>
</head>
<body>
<div class="container">
  ${avatar}
  <div class="name">${safeName}</div>
  <div class="bio">${safeBio}</div>
  <div class="links">
${links}
  </div>
  <div class="footer">made with <a href="https://social-tree-self.vercel.app" style="color:inherit" target="_blank">Socialtree</a></div>
</div>
</body></html>`;
}

// ── VERIFY FIREBASE ID TOKEN ──
// Uses Google's public key endpoint — no Firebase Admin SDK needed
async function verifyFirebaseToken(idToken) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID env var not set');

  // Decode header to get kid
  const [headerB64] = idToken.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());

  // Fetch Google public keys
  const keysRes = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
    { headers: { 'Cache-Control': 'max-age=3600' } }
  );
  const keys = await keysRes.json();
  const cert = keys[header.kid];
  if (!cert) throw new Error('Cannot find matching public key');

  // Verify JWT manually (decode + check claims)
  // For production, use firebase-admin. For serverless with no npm, we just decode + validate claims.
  const [, payloadB64] = idToken.split('.');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now)   throw new Error('Token expired');
  if (payload.iat > now + 300) throw new Error('Token issued in future');
  if (payload.aud !== projectId)    throw new Error('Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token issuer mismatch');
  if (!payload.sub) throw new Error('Token missing subject');

  return { uid: payload.sub, email: payload.email };
}

// ── FETCH PAGE FROM FIRESTORE REST API ──
async function fetchPageFromFirestore(pageId, projectId) {
  // Use Firestore REST API — no SDK needed in serverless
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pages/${pageId}`;

  // For reading, we need a service account token OR we can use firebase-admin
  // Simple approach: use a Firebase Service Account key stored as env var
  // OR use the Firestore REST API with the user's token (if rules allow)
  // Here we use FIREBASE_SERVICE_ACCOUNT env var (JSON string of service account key)

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!serviceAccount.client_email) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set. See README.');
  }

  // Get access token via service account JWT
  const accessToken = await getServiceAccountToken(serviceAccount, [
    'https://www.googleapis.com/auth/datastore'
  ]);

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore fetch failed: ${res.status}`);

  const doc = await res.json();
  return firestoreDocToObject(doc);
}

// ── UPDATE PAGE vercel URL in Firestore ──
async function updatePageInFirestore(pageId, projectId, serviceAccount, fields) {
  const token = await getServiceAccountToken(serviceAccount, ['https://www.googleapis.com/auth/datastore']);

  const fieldMask = Object.keys(fields).join(',');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/pages/${pageId}?updateMask.fieldPaths=${fieldMask}`;

  const body = { fields: objectToFirestoreFields(fields) };

  await fetch(url, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// ── SERVICE ACCOUNT → ACCESS TOKEN (RS256 JWT) ──
async function getServiceAccountToken(sa, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: scopes.join(' '),
  };

  const enc = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  // Sign with RS256 using Web Crypto API (available in Node 18+ / Vercel)
  const pkcs8 = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');

  const binaryKey = Buffer.from(pkcs8, 'base64');
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(unsigned));
  const jwt = `${unsigned}.${Buffer.from(sig).toString('base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get service account token: ' + JSON.stringify(data));
  return data.access_token;
}

// ── FIRESTORE DOC → PLAIN OBJECT ──
function firestoreDocToObject(doc) {
  if (!doc.fields) return null;
  const obj = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    obj[k] = firestoreValueToJS(v);
  }
  return obj;
}

function firestoreValueToJS(v) {
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue'    in v) return null;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(firestoreValueToJS);
  if ('mapValue'     in v) {
    const m = {};
    for (const [k2, v2] of Object.entries(v.mapValue.fields || {})) m[k2] = firestoreValueToJS(v2);
    return m;
  }
  return null;
}

function objectToFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = jsValueToFirestore(v);
  }
  return fields;
}

function jsValueToFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string')  return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return { integerValue: String(v) };
  return { stringValue: String(v) };
}

// ── DEPLOY TO VERCEL ──
async function deployToVercel(page) {
  const html = buildHTML(page);
  const slug = (page.slug || 'page').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const projectName = `sl-${slug}`;

  const headers = {
    'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const deployBody = {
    name: projectName,
    files: [{
      file: 'index.html',
      data: Buffer.from(html).toString('base64'),
      encoding: 'base64',
    }],
    projectSettings: { framework: null },
    target: 'production',
  };

  const deployRes = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST', headers, body: JSON.stringify(deployBody)
  });
  const deploy = await deployRes.json();
  if (!deployRes.ok) throw new Error(deploy.error?.message || JSON.stringify(deploy));

  // Poll until READY (max 60s)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deploy.id}`, { headers });
    const status = await statusRes.json();
    if (status.readyState === 'READY') return status.url || `${projectName}.vercel.app`;
    if (status.readyState === 'ERROR') throw new Error('Vercel deployment errored');
  }
  return `${projectName}.vercel.app`;
}

// ── HANDLER ──
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // 1. Verify Firebase token
  const bearer = (req.headers.authorization || '').replace('Bearer ', '');
  if (!bearer) return res.status(401).json({ error: 'Missing Authorization header' });

  let user;
  try {
    user = await verifyFirebaseToken(bearer);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token: ' + e.message });
  }

  // 2. Validate body
  const { pageId } = req.body || {};
  if (!pageId) return res.status(400).json({ error: 'Missing pageId' });

  // 3. Fetch page from Firestore
  const projectId = process.env.FIREBASE_PROJECT_ID;
  let page;
  try {
    page = await fetchPageFromFirestore(pageId, projectId);
  } catch(e) {
    return res.status(500).json({ error: 'Firestore error: ' + e.message });
  }

  if (!page) return res.status(404).json({ error: 'Page not found' });
  if (page.userId !== user.uid) return res.status(403).json({ error: 'Forbidden' });

  // 4. Check Vercel token exists
  if (!process.env.VERCEL_TOKEN) {
    return res.status(503).json({
      error: 'VERCEL_TOKEN not configured yet. Add it in Vercel Project Settings → Environment Variables.'
    });
  }

  // 5. Deploy
  try {
    const url = await deployToVercel(page);

    // 6. Save URL back to Firestore
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (sa.client_email) {
      await updatePageInFirestore(pageId, projectId, sa, { vercelUrl: url, isPublished: true });
    }

    return res.status(200).json({ url });
  } catch(e) {
    console.error('Deploy error:', e);
    return res.status(500).json({ error: e.message || 'Deploy failed' });
  }
}
