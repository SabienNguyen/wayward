# Wayward

A minimalist goals tracker built around intentional progress — not deadlines. Set up to three goals, break them into milestones, and log sessions as you work toward them.

## Features

- **Goals** — up to 3 active goals, each with a name, description, motivation, and orientation (learning vs. performance)
- **Milestones** — per-goal checkpoints you can mark complete as you progress
- **Session log** — timestamped entries per goal to record what you worked on and when
- **Google Auth** — sign in with Google; all data is scoped to your account
- **Literary aesthetic** — Cormorant + Crimson Pro typography on a coffee-toned DaisyUI theme

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | SvelteKit 2 + Svelte 5 |
| Styling | Tailwind v4 + DaisyUI (coffee theme) |
| Backend | Firebase (Firestore + Auth) |
| Build | Vite + static adapter |
| PWA | vite-plugin-pwa |
| Tests | Vitest |

## Data Model

```
users/{uid}/
  goals/{goalId}          — name, description, motivation, orientation, created_at
    sessions/{sessionId}  — content, logged_at
    milestones/{id}       — name, completed, created_at
```

## Getting Started

### 1. Firebase project

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore** and **Authentication → Google provider**
3. Copy your web app config

### 2. Environment

```bash
cp .env.example .env
```

Fill in `.env` with your Firebase config values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Install and run

```bash
npm install
npm run dev
```

## Commands

```bash
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm run preview      # Preview production build locally
npm run check        # TypeScript check
npm run test         # Run Vitest tests
```

## Firestore Security Rules

Deploy the included rules before going to production:

```bash
firebase deploy --only firestore:rules
```

The rules in `firestore.rules` restrict each user to their own data path (`users/{uid}/...`).
