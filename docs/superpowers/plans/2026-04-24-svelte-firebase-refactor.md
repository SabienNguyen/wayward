# Wayward — Svelte 5 + Firebase Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Tauri/Rust backend with Firebase, pivot the app from Eisenhower task lists to goal planning (with sessions + milestones), and ship it as a SvelteKit PWA.

**Architecture:** SvelteKit static SPA with `ssr = false` (already set). All state lives in Firestore under `users/{uid}/goals/{goalId}` with sessions and milestones as subcollections. Auth is Firebase Google sign-in; Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) replace all Svelte 4 patterns.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Firebase SDK v10 (modular), `vite-plugin-pwa`, `@sveltejs/adapter-static`, Vitest, `@testing-library/svelte`

---

## File Map

**Delete:**
- `src-tauri/` (entire directory)
- `src/lib/tauri.ts`
- `src/lib/stores/tasks.ts`
- `src/lib/stores/journal.ts`
- `src/lib/stores/goals.ts`
- `src/lib/components/GoalsStrip.svelte`
- `src/lib/components/TaskList.svelte`
- `src/lib/components/AddTaskForm.svelte`
- `src/lib/components/JournalEntryForm.svelte`
- `src/routes/do/` (directory)
- `src/routes/journal/` (directory)
- `src/routes/goals/+page.svelte` (replaced by new goals list)

**Modify:**
- `package.json` — remove Tauri deps, add Firebase + vite-plugin-pwa + Vitest
- `vite.config.ts` — strip Tauri config, add VitePWA plugin
- `src/routes/+layout.svelte` — remove GoalsStrip/mode toggle, add auth header
- `src/routes/+layout.ts` — already correct (`ssr = false`), remove Tauri comment
- `src/routes/+page.svelte` — redirect to `/goals`

**Create:**
- `.env.example`
- `vitest.config.ts`
- `firestore.rules`
- `firebase.json`
- `src/lib/firebase.ts`
- `src/lib/types.ts`
- `src/lib/validation.ts`
- `src/lib/validation.test.ts`
- `src/lib/stores/auth.svelte.ts`
- `src/lib/stores/goals.svelte.ts`
- `src/lib/firestore/sessions.ts`
- `src/lib/firestore/sessions.test.ts`
- `src/lib/firestore/milestones.ts`
- `src/lib/firestore/milestones.test.ts`
- `src/lib/components/AuthGuard.svelte`
- `src/lib/components/GoalCard.svelte`
- `src/lib/components/GoalForm.svelte`
- `src/lib/components/MilestoneList.svelte`
- `src/lib/components/SessionLog.svelte`
- `src/routes/login/+page.svelte`
- `src/routes/goals/+page.svelte` (new goals list)
- `src/routes/goals/new/+page.svelte`
- `src/routes/goals/[id]/+page.svelte`
- `static/icon-192.png` (placeholder — replace with real icon)
- `static/icon-512.png` (placeholder — replace with real icon)

---

## Task 1: Remove Tauri and obsolete frontend code

**Files:**
- Delete: `src-tauri/`, `src/lib/tauri.ts`, `src/lib/stores/tasks.ts`, `src/lib/stores/journal.ts`, `src/lib/stores/goals.ts`
- Delete: `src/lib/components/GoalsStrip.svelte`, `src/lib/components/TaskList.svelte`, `src/lib/components/AddTaskForm.svelte`, `src/lib/components/JournalEntryForm.svelte`
- Delete: `src/routes/do/`, `src/routes/journal/`, `src/routes/goals/+page.svelte`
- Modify: `package.json`, `vite.config.ts`, `src/routes/+layout.ts`

- [ ] **Step 1: Delete Tauri backend and obsolete source files**

```bash
rm -rf src-tauri
rm -f src/lib/tauri.ts
rm -f src/lib/stores/tasks.ts src/lib/stores/journal.ts src/lib/stores/goals.ts
rm -f src/lib/components/GoalsStrip.svelte src/lib/components/TaskList.svelte
rm -f src/lib/components/AddTaskForm.svelte src/lib/components/JournalEntryForm.svelte
rm -rf src/routes/do src/routes/journal
rm -f src/routes/goals/+page.svelte
```

- [ ] **Step 2: Remove Tauri dependencies from package.json**

Replace `package.json` with:

```json
{
  "name": "wayward",
  "version": "0.1.0",
  "description": "",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "license": "MIT",
  "dependencies": {
    "firebase": "^11.0.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-static": "^3.0.6",
    "@sveltejs/kit": "^2.9.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@testing-library/svelte": "^5.0.0",
    "jsdom": "^25.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "typescript": "~5.6.2",
    "vite": "^6.0.3",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Strip Tauri config from vite.config.ts**

Replace `vite.config.ts` with:

```typescript
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Wayward',
        short_name: 'Wayward',
        description: 'Plan goals that matter',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 4: Clean up +layout.ts**

Replace `src/routes/+layout.ts` with:

```typescript
export const ssr = false;
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: no errors, `node_modules/firebase` present.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Tauri, journal, and task list code"
```

---

## Task 2: Firebase config + types

**Files:**
- Create: `.env.example`, `src/lib/firebase.ts`, `src/lib/types.ts`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

- [ ] **Step 2: Copy .env.example to .env and fill in real values**

```bash
cp .env.example .env
```

Then open `.env` and populate with values from your Firebase console (Project Settings → Your apps → Web app → SDK setup and configuration).

- [ ] **Step 3: Create src/lib/firebase.ts**

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

- [ ] **Step 4: Create src/lib/types.ts**

```typescript
export interface Goal {
  id: string;
  name: string;
  description: string;
  motivation: string;
  orientation: 'performance' | 'learning';
  created_at: number;
}

export interface Session {
  id: string;
  content: string;
  logged_at: number;
}

export interface Milestone {
  id: string;
  name: string;
  completed: boolean;
  created_at: number;
}

export interface GoalFormData {
  name: string;
  description: string;
  motivation: string;
  orientation: 'performance' | 'learning' | '';
}
```

- [ ] **Step 5: Add .env to .gitignore**

```bash
grep -qxF '.env' .gitignore || echo '.env' >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Firebase init and shared types"
```

---

## Task 3: Vitest setup

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Verify Vitest runs**

```bash
npm test
```

Expected: `No test files found` (not a failure — no tests exist yet).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add Vitest config"
```

---

## Task 4: Validation logic (TDD)

**Files:**
- Create: `src/lib/validation.ts`, `src/lib/validation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateGoalForm } from './validation';

describe('validateGoalForm', () => {
  it('returns error when name is empty', () => {
    expect(validateGoalForm({ name: '', description: '', motivation: '', orientation: 'learning' }))
      .toBe('Goal name is required');
  });

  it('returns error when name is only whitespace', () => {
    expect(validateGoalForm({ name: '   ', description: '', motivation: '', orientation: 'learning' }))
      .toBe('Goal name is required');
  });

  it('returns error when orientation is not set', () => {
    expect(validateGoalForm({ name: 'My goal', description: '', motivation: '', orientation: '' }))
      .toBe('Please select an orientation');
  });

  it('returns null when form is valid with learning orientation', () => {
    expect(validateGoalForm({ name: 'My goal', description: '', motivation: '', orientation: 'learning' }))
      .toBeNull();
  });

  it('returns null when form is valid with performance orientation', () => {
    expect(validateGoalForm({ name: 'My goal', description: 'some detail', motivation: 'because', orientation: 'performance' }))
      .toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test
```

Expected: `Cannot find module './validation'`

- [ ] **Step 3: Implement validation.ts**

Create `src/lib/validation.ts`:

```typescript
import type { GoalFormData } from './types';

export function validateGoalForm(data: GoalFormData): string | null {
  if (!data.name.trim()) return 'Goal name is required';
  if (!data.orientation) return 'Please select an orientation';
  return null;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: add goal form validation (TDD)"
```

---

## Task 5: Firestore session helpers (TDD)

**Files:**
- Create: `src/lib/firestore/sessions.ts`, `src/lib/firestore/sessions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/firestore/sessions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collRef'),
  addDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

import { addDoc, getDocs } from 'firebase/firestore';
import { addSession, loadSessions } from './sessions';

beforeEach(() => vi.clearAllMocks());

describe('addSession', () => {
  it('calls addDoc with content and server timestamp', async () => {
    await addSession('uid1', 'goal1', 'Great session');
    expect(addDoc).toHaveBeenCalledWith(
      'collRef',
      { content: 'Great session', logged_at: 'SERVER_TS' }
    );
  });
});

describe('loadSessions', () => {
  it('returns empty array when no docs', async () => {
    const result = await loadSessions('uid1', 'goal1');
    expect(result).toEqual([]);
  });

  it('maps Firestore docs to Session objects', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{
        id: 'sess1',
        data: () => ({ content: 'Did well', logged_at: { toMillis: () => 1000 } }),
      }],
    } as any);
    const result = await loadSessions('uid1', 'goal1');
    expect(result).toEqual([{ id: 'sess1', content: 'Did well', logged_at: 1000 }]);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test
```

Expected: `Cannot find module './sessions'`

- [ ] **Step 3: Implement sessions.ts**

Create `src/lib/firestore/sessions.ts`:

```typescript
import { db } from '$lib/firebase';
import {
  collection, addDoc, getDocs,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import type { Session } from '$lib/types';

function path(uid: string, goalId: string) {
  return `users/${uid}/goals/${goalId}/sessions`;
}

export async function loadSessions(uid: string, goalId: string): Promise<Session[]> {
  const q = query(collection(db, path(uid, goalId)), orderBy('logged_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    content: d.data().content as string,
    logged_at: d.data().logged_at?.toMillis?.() ?? Date.now(),
  }));
}

export async function addSession(uid: string, goalId: string, content: string): Promise<void> {
  await addDoc(collection(db, path(uid, goalId)), {
    content,
    logged_at: serverTimestamp(),
  });
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/sessions.ts src/lib/firestore/sessions.test.ts
git commit -m "feat: add session Firestore helpers (TDD)"
```

---

## Task 6: Firestore milestone helpers (TDD)

**Files:**
- Create: `src/lib/firestore/milestones.ts`, `src/lib/firestore/milestones.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/firestore/milestones.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collRef'),
  addDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  updateDoc: vi.fn(),
  doc: vi.fn(() => 'docRef'),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

import { addDoc, getDocs, updateDoc } from 'firebase/firestore';
import { addMilestone, loadMilestones, toggleMilestone } from './milestones';

beforeEach(() => vi.clearAllMocks());

describe('addMilestone', () => {
  it('calls addDoc with name, completed false, and timestamp', async () => {
    await addMilestone('uid1', 'goal1', 'Ship MVP');
    expect(addDoc).toHaveBeenCalledWith(
      'collRef',
      { name: 'Ship MVP', completed: false, created_at: 'SERVER_TS' }
    );
  });
});

describe('loadMilestones', () => {
  it('returns empty array when no docs', async () => {
    expect(await loadMilestones('uid1', 'goal1')).toEqual([]);
  });

  it('maps docs to Milestone objects', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [{
        id: 'm1',
        data: () => ({ name: 'First milestone', completed: true, created_at: { toMillis: () => 500 } }),
      }],
    } as any);
    expect(await loadMilestones('uid1', 'goal1')).toEqual([
      { id: 'm1', name: 'First milestone', completed: true, created_at: 500 }
    ]);
  });
});

describe('toggleMilestone', () => {
  it('calls updateDoc with completed value', async () => {
    await toggleMilestone('uid1', 'goal1', 'm1', true);
    expect(updateDoc).toHaveBeenCalledWith('docRef', { completed: true });
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test
```

Expected: `Cannot find module './milestones'`

- [ ] **Step 3: Implement milestones.ts**

Create `src/lib/firestore/milestones.ts`:

```typescript
import { db } from '$lib/firebase';
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import type { Milestone } from '$lib/types';

function path(uid: string, goalId: string) {
  return `users/${uid}/goals/${goalId}/milestones`;
}

export async function loadMilestones(uid: string, goalId: string): Promise<Milestone[]> {
  const q = query(collection(db, path(uid, goalId)), orderBy('created_at', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    name: d.data().name as string,
    completed: d.data().completed as boolean,
    created_at: d.data().created_at?.toMillis?.() ?? Date.now(),
  }));
}

export async function addMilestone(uid: string, goalId: string, name: string): Promise<void> {
  await addDoc(collection(db, path(uid, goalId)), {
    name,
    completed: false,
    created_at: serverTimestamp(),
  });
}

export async function toggleMilestone(
  uid: string, goalId: string, milestoneId: string, completed: boolean
): Promise<void> {
  await updateDoc(doc(db, path(uid, goalId), milestoneId), { completed });
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
npm test
```

Expected: `12 passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/firestore/milestones.ts src/lib/firestore/milestones.test.ts
git commit -m "feat: add milestone Firestore helpers (TDD)"
```

---

## Task 7: Auth store

**Files:**
- Create: `src/lib/stores/auth.svelte.ts`

- [ ] **Step 1: Create auth.svelte.ts**

```typescript
import { auth } from '$lib/firebase';
import {
  GoogleAuthProvider, signInWithPopup,
  signOut as fbSignOut, onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

let _user = $state<User | null>(null);
let _loading = $state(true);

onAuthStateChanged(auth, (u) => {
  _user = u;
  _loading = false;
});

export const authStore = {
  get user() { return _user; },
  get loading() { return _loading; },

  async signIn() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  },

  async signOut() {
    await fbSignOut(auth);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/auth.svelte.ts
git commit -m "feat: add Firebase auth store (Svelte 5 runes)"
```

---

## Task 8: Goals store

**Files:**
- Create: `src/lib/stores/goals.svelte.ts`

- [ ] **Step 1: Create goals.svelte.ts**

```typescript
import { db } from '$lib/firebase';
import {
  collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, serverTimestamp, type DocumentData,
} from 'firebase/firestore';
import type { Goal, GoalFormData } from '$lib/types';

let _goals = $state<Goal[]>([]);

function goalsPath(uid: string) {
  return `users/${uid}/goals`;
}

function toGoal(id: string, data: DocumentData): Goal {
  return {
    id,
    name: data.name,
    description: data.description,
    motivation: data.motivation,
    orientation: data.orientation,
    created_at: data.created_at?.toMillis?.() ?? Date.now(),
  };
}

export const goalsStore = {
  get goals() { return _goals; },

  async load(uid: string) {
    const q = query(collection(db, goalsPath(uid)), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    _goals = snap.docs.map(d => toGoal(d.id, d.data()));
  },

  async create(uid: string, data: Omit<GoalFormData, 'orientation'> & { orientation: 'performance' | 'learning' }) {
    await addDoc(collection(db, goalsPath(uid)), {
      ...data,
      created_at: serverTimestamp(),
    });
    await goalsStore.load(uid);
  },

  async remove(uid: string, goalId: string) {
    await deleteDoc(doc(db, goalsPath(uid), goalId));
    _goals = _goals.filter(g => g.id !== goalId);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/goals.svelte.ts
git commit -m "feat: add goals Firestore store (Svelte 5 runes)"
```

---

## Task 9: AuthGuard + Login page

**Files:**
- Create: `src/lib/components/AuthGuard.svelte`, `src/routes/login/+page.svelte`

- [ ] **Step 1: Create AuthGuard.svelte**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  $effect(() => {
    if (!authStore.loading && !authStore.user) {
      goto('/login');
    }
  });
</script>

{#if authStore.user}
  {@render children()}
{:else if authStore.loading}
  <div class="loading-screen">Loading...</div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
  }
</style>
```

- [ ] **Step 2: Create src/routes/login/+page.svelte**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  let error = $state<string | null>(null);

  $effect(() => {
    if (authStore.user) goto('/goals');
  });

  async function handleSignIn() {
    error = null;
    try {
      await authStore.signIn();
    } catch {
      error = 'Sign in failed. Try again.';
    }
  }
</script>

<div class="login-page">
  <div class="login-card">
    <span class="logo">◆ Wayward</span>
    <p class="tagline">Plan goals that matter.</p>
    {#if error}<p class="error">{error}</p>{/if}
    <button class="btn-primary" onclick={handleSignIn}>Sign in with Google</button>
  </div>
</div>

<style>
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .login-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 40px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    text-align: center;
  }

  .logo {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
  }

  .tagline {
    color: var(--text-muted);
    font-size: 14px;
  }

  .error {
    color: var(--error, #e05);
    font-size: 13px;
  }

  .btn-primary {
    padding: 10px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/AuthGuard.svelte src/routes/login/+page.svelte
git commit -m "feat: add AuthGuard component and login page"
```

---

## Task 10: GoalCard + GoalForm components

**Files:**
- Create: `src/lib/components/GoalCard.svelte`, `src/lib/components/GoalForm.svelte`

- [ ] **Step 1: Create GoalCard.svelte**

```svelte
<script lang="ts">
  import type { Goal } from '$lib/types';

  let { goal, onclick }: { goal: Goal; onclick: () => void } = $props();
</script>

<div
  class="goal-card"
  role="button"
  tabindex="0"
  {onclick}
  onkeydown={(e) => e.key === 'Enter' && onclick()}
>
  <div class="card-header">
    <span class="goal-name">{goal.name}</span>
    <span class="orientation-badge" class:performance={goal.orientation === 'performance'}>
      {goal.orientation}
    </span>
  </div>
  {#if goal.description}
    <p class="goal-description">{goal.description}</p>
  {/if}
</div>

<style>
  .goal-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    cursor: pointer;
    box-shadow: var(--shadow);
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }

  .goal-card:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--accent);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .goal-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }

  .orientation-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    flex-shrink: 0;
  }

  .orientation-badge.performance {
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    color: #b45309;
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
  }

  .goal-description {
    margin-top: 8px;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    white-space: pre-wrap;
  }
</style>
```

- [ ] **Step 2: Create GoalForm.svelte**

```svelte
<script lang="ts">
  import { validateGoalForm } from '$lib/validation';
  import type { GoalFormData } from '$lib/types';

  let { onsubmit }: {
    onsubmit: (data: GoalFormData & { orientation: 'performance' | 'learning' }) => void;
  } = $props();

  let name = $state('');
  let description = $state('');
  let motivation = $state('');
  let orientation = $state<'performance' | 'learning' | ''>('');
  let error = $state<string | null>(null);

  function handleSubmit() {
    const data: GoalFormData = { name, description, motivation, orientation };
    const err = validateGoalForm(data);
    if (err) { error = err; return; }
    error = null;
    onsubmit(data as GoalFormData & { orientation: 'performance' | 'learning' });
  }
</script>

<form class="goal-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
  <div class="field">
    <label for="name">Goal name</label>
    <input id="name" bind:value={name} placeholder="What do you want to achieve?" />
  </div>

  <div class="field">
    <label for="description">Description</label>
    <textarea id="description" bind:value={description} rows="3"
      placeholder="What does achieving this look like?"></textarea>
  </div>

  <div class="field">
    <label for="motivation">Motivation</label>
    <textarea id="motivation" bind:value={motivation} rows="2"
      placeholder="Why does this matter to you?"></textarea>
  </div>

  <div class="field">
    <label>Orientation</label>
    <div class="orientation-options">
      <label class="radio-label" class:selected={orientation === 'learning'}>
        <input type="radio" bind:group={orientation} value="learning" />
        <span>
          <strong>Learning</strong>
          <span class="radio-hint">Improve, discover, master</span>
        </span>
      </label>
      <label class="radio-label" class:selected={orientation === 'performance'}>
        <input type="radio" bind:group={orientation} value="performance" />
        <span>
          <strong>Performance</strong>
          <span class="radio-hint">Prove it, hit a benchmark</span>
        </span>
      </label>
    </div>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button type="submit" class="btn-primary">Save Goal</button>
</form>

<style>
  .goal-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  input, textarea {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
  }

  .orientation-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 14px;
    font-weight: normal;
    text-transform: none;
    letter-spacing: normal;
    color: var(--text);
    transition: border-color 0.15s ease;
  }

  .radio-label.selected {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 5%, transparent);
  }

  .radio-hint {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: normal;
  }

  .error {
    font-size: 13px;
    color: var(--error, #e05);
  }

  .btn-primary {
    padding: 10px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/GoalCard.svelte src/lib/components/GoalForm.svelte
git commit -m "feat: add GoalCard and GoalForm components"
```

---

## Task 11: MilestoneList + SessionLog components

**Files:**
- Create: `src/lib/components/MilestoneList.svelte`, `src/lib/components/SessionLog.svelte`

- [ ] **Step 1: Create MilestoneList.svelte**

```svelte
<script lang="ts">
  import type { Milestone } from '$lib/types';

  let { milestones, onadd, ontoggle }: {
    milestones: Milestone[];
    onadd: (name: string) => void;
    ontoggle: (id: string, completed: boolean) => void;
  } = $props();

  let newName = $state('');

  const completed = $derived(milestones.filter(m => m.completed).length);

  function handleAdd() {
    if (!newName.trim()) return;
    onadd(newName.trim());
    newName = '';
  }
</script>

<section class="milestones">
  <div class="section-header">
    <h3>Milestones</h3>
    {#if milestones.length > 0}
      <span class="progress">{completed}/{milestones.length} done</span>
    {/if}
  </div>

  {#each milestones as m (m.id)}
    <label class="milestone-item" class:done={m.completed}>
      <input
        type="checkbox"
        checked={m.completed}
        onchange={(e) => ontoggle(m.id, e.currentTarget.checked)}
      />
      <span class="milestone-name">{m.name}</span>
    </label>
  {/each}

  <form class="add-form" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <input bind:value={newName} placeholder="Add a milestone..." />
    <button type="submit" class="btn-ghost">Add</button>
  </form>
</section>

<style>
  .milestones {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 32px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  h3 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0;
  }

  .progress {
    font-size: 12px;
    color: var(--text-muted);
  }

  .milestone-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 14px;
    color: var(--text);
    font-weight: normal;
    text-transform: none;
    letter-spacing: normal;
  }

  .milestone-item.done .milestone-name {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .add-form {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .add-form input {
    flex: 1;
    padding: 7px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
  }

  .btn-ghost {
    padding: 7px 14px;
    border-radius: var(--radius);
    font-size: 14px;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Create SessionLog.svelte**

```svelte
<script lang="ts">
  import type { Session } from '$lib/types';

  let { sessions, orientation, onadd }: {
    sessions: Session[];
    orientation: 'performance' | 'learning';
    onadd: (content: string) => void;
  } = $props();

  const placeholder = $derived(
    orientation === 'performance'
      ? 'How did you benchmark? What did you hit?'
      : 'What did you discover? What improved?'
  );

  let content = $state('');

  function handleAdd() {
    if (!content.trim()) return;
    onadd(content.trim());
    content = '';
  }
</script>

<section class="session-log">
  <h3>Session Log</h3>

  <form class="session-form" onsubmit={(e) => { e.preventDefault(); handleAdd(); }}>
    <textarea bind:value={content} {placeholder} rows="3"></textarea>
    <div class="form-footer">
      <button type="submit" class="btn-primary">Log Session</button>
    </div>
  </form>

  <div class="sessions">
    {#each sessions as s (s.id)}
      <div class="session-entry">
        <time class="session-time">
          {new Date(s.logged_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
        </time>
        <p class="session-content">{s.content}</p>
      </div>
    {:else}
      <p class="empty">No sessions logged yet.</p>
    {/each}
  </div>
</section>

<style>
  .session-log {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h3 {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0;
  }

  .session-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow);
  }

  .session-form textarea {
    width: 100%;
    padding: 12px 14px;
    border: none;
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    resize: vertical;
    min-height: 80px;
    box-sizing: border-box;
  }

  .form-footer {
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--surface-2);
  }

  .btn-primary {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .sessions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .session-entry {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
  }

  .session-time {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
  }

  .session-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
    white-space: pre-wrap;
    margin: 0;
  }

  .empty {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MilestoneList.svelte src/lib/components/SessionLog.svelte
git commit -m "feat: add MilestoneList and SessionLog components"
```

---

## Task 12: Wire all routes

**Files:**
- Modify: `src/routes/+layout.svelte`, `src/routes/+page.svelte`
- Create: `src/routes/goals/+page.svelte`, `src/routes/goals/new/+page.svelte`, `src/routes/goals/[id]/+page.svelte`

- [ ] **Step 1: Update +layout.svelte**

Replace `src/routes/+layout.svelte` with:

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/auth.svelte';
  import '../app.css';

  let { children } = $props();

  let theme = $state<'light' | 'dark'>('light');

  $effect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = saved ?? (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
</script>

<div class="app-shell">
  <header class="app-header">
    <span class="logo">◆ Wayward</span>
    <div class="header-actions">
      {#if authStore.user}
        <button class="btn-ghost sign-out" onclick={() => authStore.signOut()}>Sign out</button>
      {/if}
      <button class="theme-toggle btn-ghost" onclick={toggleTheme} aria-label="Toggle theme">
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  </header>

  <main class="app-content">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 48px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow);
    flex-shrink: 0;
  }

  .logo {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
    color: var(--accent);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .theme-toggle {
    font-size: 16px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .sign-out {
    font-size: 13px;
    color: var(--text-muted);
    padding: 4px 10px;
  }

  .btn-ghost {
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }
</style>
```

- [ ] **Step 2: Update root +page.svelte**

Replace `src/routes/+page.svelte` with:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  $effect(() => {
    if (!authStore.loading) {
      goto(authStore.user ? '/goals' : '/login', { replaceState: true });
    }
  });
</script>
```

- [ ] **Step 3: Create goals list page**

Create `src/routes/goals/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import GoalCard from '$lib/components/GoalCard.svelte';
  import AuthGuard from '$lib/components/AuthGuard.svelte';

  onMount(() => {
    if (authStore.user) goalsStore.load(authStore.user.uid);
  });
</script>

<AuthGuard>
  <div class="goals-page">
    <div class="page-header">
      <h2 class="section-heading">Your Goals</h2>
      <button class="btn-primary" onclick={() => goto('/goals/new')}>+ New Goal</button>
    </div>

    <div class="goals-list">
      {#each goalsStore.goals as goal (goal.id)}
        <GoalCard {goal} onclick={() => goto(`/goals/${goal.id}`)} />
      {:else}
        <div class="empty-state">
          <p>No goals yet.</p>
          <p class="muted">Start with something that genuinely matters to you.</p>
        </div>
      {/each}
    </div>
  </div>
</AuthGuard>

<style>
  .goals-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .goals-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .btn-primary {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--text);
  }

  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
```

- [ ] **Step 4: Create goals/new page**

Create `src/routes/goals/new/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import GoalForm from '$lib/components/GoalForm.svelte';
  import AuthGuard from '$lib/components/AuthGuard.svelte';
  import type { GoalFormData } from '$lib/types';

  let saving = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit(data: GoalFormData & { orientation: 'performance' | 'learning' }) {
    if (!authStore.user) return;
    saving = true;
    error = null;
    try {
      await goalsStore.create(authStore.user.uid, data);
      goto('/goals');
    } catch {
      error = 'Failed to save goal. Try again.';
      saving = false;
    }
  }
</script>

<AuthGuard>
  <div class="new-goal-page">
    <div class="page-header">
      <button class="btn-back" onclick={() => goto('/goals')}>← Back</button>
      <h2 class="section-heading">New Goal</h2>
    </div>

    {#if error}<p class="error">{error}</p>{/if}
    {#if saving}
      <p class="muted">Saving...</p>
    {:else}
      <GoalForm onsubmit={handleSubmit} />
    {/if}
  </div>
</AuthGuard>

<style>
  .new-goal-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-top: 16px;
  }

  .page-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn-back {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }

  .error {
    color: var(--error, #e05);
    font-size: 13px;
  }

  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
```

- [ ] **Step 5: Create goals/[id] detail page**

Create `src/routes/goals/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';
  import { goalsStore } from '$lib/stores/goals.svelte';
  import AuthGuard from '$lib/components/AuthGuard.svelte';
  import MilestoneList from '$lib/components/MilestoneList.svelte';
  import SessionLog from '$lib/components/SessionLog.svelte';
  import { loadSessions, addSession } from '$lib/firestore/sessions';
  import { loadMilestones, addMilestone, toggleMilestone } from '$lib/firestore/milestones';
  import type { Session, Milestone } from '$lib/types';

  const goalId = $derived(page.params.id);
  const goal = $derived(goalsStore.goals.find(g => g.id === goalId));

  let sessions = $state<Session[]>([]);
  let milestones = $state<Milestone[]>([]);

  onMount(async () => {
    if (!authStore.user) return;
    const uid = authStore.user.uid;
    if (goalsStore.goals.length === 0) await goalsStore.load(uid);
    [sessions, milestones] = await Promise.all([
      loadSessions(uid, goalId),
      loadMilestones(uid, goalId),
    ]);
  });

  async function handleAddSession(content: string) {
    if (!authStore.user) return;
    const uid = authStore.user.uid;
    await addSession(uid, goalId, content);
    sessions = await loadSessions(uid, goalId);
  }

  async function handleAddMilestone(name: string) {
    if (!authStore.user) return;
    const uid = authStore.user.uid;
    await addMilestone(uid, goalId, name);
    milestones = await loadMilestones(uid, goalId);
  }

  async function handleToggleMilestone(id: string, completed: boolean) {
    if (!authStore.user) return;
    await toggleMilestone(authStore.user.uid, goalId, id, completed);
    milestones = milestones.map(m => m.id === id ? { ...m, completed } : m);
  }

  async function handleDelete() {
    if (!authStore.user || !confirm('Delete this goal?')) return;
    await goalsStore.remove(authStore.user.uid, goalId);
    goto('/goals');
  }
</script>

<AuthGuard>
  {#if goal}
    <div class="goal-detail">
      <div class="detail-header">
        <button class="btn-back" onclick={() => goto('/goals')}>← Goals</button>
        <button class="btn-delete" onclick={handleDelete}>Delete</button>
      </div>

      <div class="goal-meta">
        <h2>{goal.name}</h2>
        <span class="orientation-badge" class:performance={goal.orientation === 'performance'}>
          {goal.orientation}
        </span>
      </div>

      {#if goal.description}
        <p class="description">{goal.description}</p>
      {/if}

      {#if goal.motivation}
        <p class="motivation"><em>Why: {goal.motivation}</em></p>
      {/if}

      <MilestoneList
        {milestones}
        onadd={handleAddMilestone}
        ontoggle={handleToggleMilestone}
      />

      <SessionLog
        {sessions}
        orientation={goal.orientation}
        onadd={handleAddSession}
      />
    </div>
  {:else}
    <p class="muted">Loading...</p>
  {/if}
</AuthGuard>

<style>
  .goal-detail {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-top: 16px;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
  }

  .btn-back, .btn-delete {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }

  .btn-back { color: var(--text-muted); }
  .btn-delete { color: #ef4444; }

  .goal-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }

  .orientation-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .orientation-badge.performance {
    background: color-mix(in srgb, #f59e0b 12%, transparent);
    color: #b45309;
    border-color: color-mix(in srgb, #f59e0b 30%, transparent);
  }

  .description, .motivation {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-muted);
    margin: 0;
  }

  .muted { color: var(--text-muted); font-size: 14px; }
</style>
```

- [ ] **Step 6: Verify TypeScript**

```bash
npm run check
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/routes/
git commit -m "feat: wire all routes — goals list, new goal, goal detail"
```

---

## Task 13: Firestore security rules + Firebase hosting config

**Files:**
- Create: `firestore.rules`, `firebase.json`

- [ ] **Step 1: Create firestore.rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 2: Create firebase.json**

```json
{
  "hosting": {
    "public": "build",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add firestore.rules firebase.json
git commit -m "feat: add Firestore security rules and Firebase hosting config"
```

---

## Task 14: Smoke test

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: `12 passed`

- [ ] **Step 2: Run dev server**

```bash
npm run dev
```

Expected: server running at `http://localhost:5173`

- [ ] **Step 3: Manual walkthrough**

Open `http://localhost:5173` in a browser. Verify:
- Root `/` redirects to `/login`
- Google sign-in button appears on `/login`
- After signing in, redirected to `/goals`
- "New Goal" button navigates to `/goals/new`
- Filling out form and saving creates a goal card on `/goals`
- Clicking a goal card navigates to `/goals/[id]`
- Adding a milestone and checking it off updates the progress count
- Logging a session appears reverse-chronologically below the form
- Sign out button in header works and returns to `/login`

- [ ] **Step 4: PWA install prompt**

Open Chrome DevTools → Application → Manifest. Verify name, icons, and display mode are correct. On mobile, verify "Add to Home Screen" appears.

- [ ] **Step 5: Add placeholder PWA icons to static/**

The PWA requires `static/icon-192.png` and `static/icon-512.png` to exist. Create two temporary solid-color placeholders, then replace with real artwork:

```bash
# Quick placeholder using ImageMagick if available:
convert -size 192x192 xc:#6366f1 static/icon-192.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/192/6366f1/ffffff.png" -o static/icon-192.png
convert -size 512x512 xc:#6366f1 static/icon-512.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/512/6366f1/ffffff.png" -o static/icon-512.png
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Wayward Svelte 5 + Firebase refactor"
```
