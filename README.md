# softlink — Setup Guide (Firebase + Vercel)

Full-stack link-in-bio SaaS. Firebase for auth + Firestore database. Vercel for hosting the main app and one-click publishing user pages.

---

## File Structure

```
softlink/
├── public/
│   ├── index.html       ← Landing page
│   ├── login.html       ← Sign in / Sign up (Firebase Auth + Google)
│   ├── dashboard.html   ← User's pages (create / edit / publish / download)
│   ├── editor.html      ← Page builder with live preview + autosave
│   ├── style.css        ← Shared design system
│   └── shared.js        ← Firebase config, Auth, DB helpers, icons, HTML generator
├── api/
│   └── publish.js       ← Vercel serverless: Firebase JWT verify → Vercel Deploy API
└── vercel.json          ← URL routing
```

---

## Step 1 — Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. **Authentication** → Sign-in method → Enable **Email/Password** and **Google**
3. **Firestore Database** → Create database → Start in **production mode**
4. Add these **security rules** in Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pages/{pageId} {

      // CREATE: must be logged in and setting their own userId
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;

      // READ own pages (owner always can)
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;

      // READ published pages (public — for slug lookup)
      allow read: if resource.data.isPublished == true;

      // UPDATE + DELETE: owner only
      allow update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }
  }
}
```

5. **Project Settings** → **Your apps** → Add a Web app → copy the config object.

6. Open `public/shared.js` and replace `FIREBASE_CONFIG` at the top:
```js
const FIREBASE_CONFIG = {
  apiKey:            "AIza...",
  authDomain:        "myproject.firebaseapp.com",
  projectId:         "myproject",
  storageBucket:     "myproject.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
```

---

## Step 2 — Firebase Service Account (for the publish API)

The serverless `/api/publish.js` needs to read Firestore as an admin.

1. Firebase Console → **Project Settings** → **Service accounts**
2. Click **Generate new private key** → download the JSON file
3. You'll add this as an env var in Step 4

---

## Step 3 — Deploy main app to Vercel

```bash
npm i -g vercel

# From the softlink/ directory
vercel

# Options:
# Link to existing project or create new
# Project name: softlink
# Root directory: ./  (the root, NOT /public)
# Build command: (leave empty — no build step)
# Output directory: public
```

After deploy you'll get a URL like `softlink.vercel.app`.

---

## Step 4 — Environment Variables

In **Vercel Dashboard → Project → Settings → Environment Variables**, add:

| Variable                  | Value                                     |
|---------------------------|-------------------------------------------|
| `FIREBASE_PROJECT_ID`     | `socialtree-web` |
| `FIREBASE_SERVICE_ACCOUNT`| The entire JSON content of the service account key file (as a string) |
| `VERCEL_TOKEN`            | *(add later)* Your Vercel personal access token |
| `VERCEL_TEAM_ID`          | *(optional)* Your Vercel team ID |

Then redeploy:
```bash
vercel --prod
```

---

## Step 5 — Add your Vercel token (one-click publish)

When you're ready to enable one-click publish:

1. Go to [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Create a **Full Account** scope token → copy it
3. Add it as `VERCEL_TOKEN` in Vercel env vars
4. Redeploy

Until `VERCEL_TOKEN` is set, the publish button shows a helpful error message. The **⬇ HTML download** always works regardless.

---

## How it all works

### Auth flow
- Users sign up / sign in via **Firebase Auth** (email+password or Google)
- Firebase issues a JWT **ID token** client-side
- Every page load calls `Auth.onStateChange()` — if no user, redirect to login

### Data flow
- All pages stored in **Firestore** `pages` collection
- Firestore security rules enforce that users can only read/write their own documents
- The editor **autosaves** to Firestore 1.1s after each keystroke (debounced)

### One-click publish flow
```
User clicks Publish
  → Editor calls POST /api/publish with Firebase ID token
  → Serverless function verifies the Firebase JWT (using Google's public certs)
  → Fetches the page from Firestore via REST API (using service account token)
  → Generates a self-contained HTML file with all SVG icons embedded
  → Deploys to Vercel via Deploy API as project "sl-{slug}"
  → Polls every 3s until deployment is READY (max 60s)
  → Saves the live URL back to Firestore
  → Returns { url } to the frontend
```

Each user's page lives at `sl-{slug}.vercel.app` as its own Vercel project.

### HTML download flow
- Entirely client-side — no server needed
- `generatePageHTML()` in `shared.js` builds a complete standalone HTML file
- All social SVG icons are embedded inline — no external requests
- Can be hosted on GitHub Pages, Netlify, Cloudflare Pages, etc.

---

## Customisation

- **Brand**: Change `--rose` in `style.css` and logo text in HTML files
- **Add social icon**: Add to the `ICONS` object in both `shared.js` and `api/publish.js`
- **Add theme**: Add to the `THEMES` map in `generatePageHTML()` in both files
- **Custom domain per user**: After deploy, call the Vercel Domains API in `api/publish.js`
- **Avatar storage**: Currently stored as base64 in Firestore (fine for small images). For larger files, swap for **Firebase Storage** and store the URL instead.
