# Wayward — Svelte 5 + Firebase Refactor Design

**Date:** 2026-04-24
**Status:** Approved

## Overview

Wayward is being refactored from a Tauri/Rust desktop app with SQLite into a SvelteKit PWA backed by Firebase. The core product pivot removes the Eisenhower Matrix task lists and journal, replacing them with a goal-planning system inspired by Achievement Goal Theory (performance vs. learning orientation) and the ULM's multi-timescale view of skill acquisition.

## What's Being Removed

- All of `src-tauri/` (Rust backend, SQLite, IPC commands, LAN sync, lock scheduler)
- `src/lib/tauri.ts`
- Journal route and all journal-related stores/components
- Do mode (Q1/Q2 task lists)
- `@tauri-apps/api` and `@tauri-apps/cli` dependencies

## What's Being Built

### Core Feature: Goal Planning

Each goal captures:
- **Name** — what the goal is
- **Description** — more detail on what achieving it looks like
- **Motivation** — why this matters to the user (free text)
- **Orientation** — `'performance'` (prove it, beat a benchmark) or `'learning'` (improve, discover, master)

Users can attach two types of child records to each goal:

**Sessions** — free-form progress notes logged over time, reverse-chronological. Captures what happened in a practice/work session. UI language adapts to orientation: performance goals prompt "how did you benchmark?" while learning goals prompt "what did you discover?"

**Milestones** — named checkpoints the user can mark complete. Shown as a progress indicator (X/Y done) on the goal card.

## Data Model (Firestore)

```
users/{uid}/goals/{goalId}
  name:         string
  description:  string
  motivation:   string
  orientation:  'performance' | 'learning'
  created_at:   timestamp

users/{uid}/goals/{goalId}/sessions/{sessionId}
  content:      string
  logged_at:    timestamp

users/{uid}/goals/{goalId}/milestones/{milestoneId}
  name:         string
  completed:    boolean
  created_at:   timestamp
```

Firestore security rules: `allow read, write: if request.auth.uid == userId` — all data is scoped to the authenticated user's UID.

## Routes

| Route | Purpose |
|---|---|
| `/` | Redirect to `/goals` (or `/login` if unauthenticated) |
| `/login` | Firebase Auth sign-in (Google) |
| `/goals` | List all goals, one `GoalCard` per goal |
| `/goals/new` | Create a goal (`GoalForm`) |
| `/goals/[id]` | Goal detail: milestone list + session log |

## Components

| Component | Responsibility |
|---|---|
| `GoalCard.svelte` | Name, orientation badge, milestone progress (X/Y done) |
| `GoalForm.svelte` | Name, description, motivation textarea, orientation toggle |
| `MilestoneList.svelte` | Add milestones, check them off |
| `SessionLog.svelte` | Add session note, view past entries reverse-chronologically |
| `AuthGuard.svelte` | Wraps protected routes, redirects to `/login` if no user |

The existing `GoalsStrip`, `TaskList`, `AddTaskForm`, and `JournalEntryForm` components are all removed.

## State Management

Svelte 5 runes throughout — no `writable` stores.

- `src/lib/stores/auth.svelte.ts` — `$state` for the Firebase `User` object; exports `user` and `signIn`/`signOut` helpers
- `src/lib/stores/goals.svelte.ts` — `$state` for the goals list; Firestore CRUD (create, list, delete)
- Sessions and milestones are loaded per goal inside `/goals/[id]` — not global state

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend framework | SvelteKit + Svelte 5 (runes) |
| Auth | Firebase Auth (Google sign-in) |
| Database | Firestore (Firebase SDK v10, modular) |
| PWA | `vite-plugin-pwa` — web manifest + service worker |
| Build output | `@sveltejs/adapter-static` (existing) |
| Hosting | Firebase Hosting (static build) |
| Config | `.env` with `VITE_FIREBASE_*` vars, not committed |

## Migration Notes

- Svelte 4 patterns (`export let`, `on:click`, `$:`) → Svelte 5 runes (`$props()`, `onclick`, `$derived`)
- `invoke()` calls → Firestore SDK calls
- `+layout.svelte` simplified: GoalsStrip and mode toggle removed; header becomes auth status + sign-out
- `adapter-static` stays; `tauri` script removed from `package.json`
- `src-tauri/` directory deleted entirely
