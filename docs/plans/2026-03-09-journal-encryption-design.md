# Journal Password Lock & Encryption Design

**Date:** 2026-03-09

## Overview

Add password protection to the journal with AES-256-GCM per-entry encryption. Entries stored in SQLite as encrypted ciphertext — unreadable without the password even if the database file is accessed directly. Recovery via a user-set PIN.

## Requirements

- Password required every time the journal tab is opened
- Entry content encrypted at rest in SQLite (not UI-only)
- PIN-based password recovery (no server, fully local)
- Existing entries encrypted on first password setup
- Transparent crypto — frontend sees only plaintext, never keys or ciphertext

## Cryptographic Architecture

### Key Derivation

- **Password → content_key**: `Argon2id(password, argon2_salt_password)` → 32-byte AES key
- **PIN → pin_key**: `Argon2id(pin, argon2_salt_pin)` → 32-byte AES key
- The `content_key` is stored encrypted by `pin_key` in the `config` table

### Why Wrap the Key

Storing `encrypt(content_key, pin_key)` means PIN recovery only needs to re-encrypt the single wrapped key — no re-encryption of all entries required.

### Per-Entry Encryption

- Each `content` field stored as `base64(nonce || ciphertext)` in SQLite
- 96-bit random nonce generated per entry
- AES-256-GCM provides encryption + authentication (tamper detection)

### Config Table Entries

| Key | Value |
|-----|-------|
| `argon2_salt_password` | hex-encoded Argon2 salt for password KDF |
| `argon2_salt_pin` | hex-encoded Argon2 salt for PIN KDF |
| `encrypted_content_key` | `base64(nonce \|\| AES-GCM(content_key, pin_key))` |
| `journal_lock_enabled` | `"true"` |

## Data Layer

### Migration

No schema changes needed. `content TEXT NOT NULL` already accommodates base64 ciphertext strings. The `config` table already exists.

### New Module: `src-tauri/src/crypto.rs`

- `derive_key(password, salt) -> [u8; 32]` — Argon2id KDF
- `encrypt(key, plaintext) -> String` — AES-256-GCM, returns `base64(nonce || ciphertext)`
- `decrypt(key, ciphertext) -> Result<String>` — returns error on wrong key or tampered data
- `setup_password(pool, password, pin)` — first-time setup; derives keys, stores config, encrypts all existing entries
- `verify_and_get_key(pool, password) -> Result<[u8; 32]>` — re-derives key, verifies against stored verification value
- `recover_with_pin(pool, pin, new_password)` — decrypts `content_key` with PIN, re-encrypts with new password

### Rust Dependencies

- `aes-gcm` — AES-256-GCM encryption
- `argon2` — Argon2id key derivation
- `base64` — ciphertext encoding for SQLite
- `rand` — nonce generation

## Tauri Commands

New commands in `src-tauri/src/commands/journal.rs`:

- `cmd_setup_journal_password(password, pin)` — first-time setup
- `cmd_unlock_journal(password) -> bool` — verify and store key in AppState memory
- `cmd_recover_journal(pin, new_password)` — PIN recovery
- `cmd_is_journal_locked() -> bool` — check if lock is enabled

### AppState Change

Add `journal_key: Mutex<Option<[u8; 32]>>` to hold the in-memory decryption key after unlock. Never persisted to disk. Cleared when journal tab is left (lock-on-every-visit behavior).

Existing commands (`cmd_create_journal_entry`, `cmd_update_journal_entry`, `cmd_list_journal_entries`) read the in-memory key from AppState and encrypt/decrypt transparently.

## Frontend Flow

In `src/routes/journal/+page.svelte`:

1. On mount: call `cmd_is_journal_locked()`
2. **No password set** → show setup screen (password + PIN inputs)
3. **Password set, locked** → show password input screen
4. **Unlocked** → load and display entries (plaintext from Rust)

The frontend never handles keys or ciphertext — all crypto is in Rust.

## Out of Scope

- Changing password (can add later)
- Locking after inactivity
- Per-entry granular access control
