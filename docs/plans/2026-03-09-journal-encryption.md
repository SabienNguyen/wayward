# Journal Password Lock & Encryption Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add AES-256-GCM per-entry encryption to the journal, gated by a password that must be entered each visit, with PIN-based recovery.

**Architecture:** Password and PIN each derive a 32-byte AES key via Argon2id. A randomly-generated `content_key` encrypts each journal entry; that key is stored encrypted by both the password-key and pin-key in the `config` table. All crypto lives in Rust — the frontend only passes passwords and receives plaintext.

**Tech Stack:** `aes-gcm 0.10`, `argon2 0.5`, `base64 0.22`, `rand 0.8`, SQLite `config` table, Svelte `onMount`/`onDestroy` for lock lifecycle.

---

### Task 1: Add crypto dependencies to Cargo.toml

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add dependencies**

In the `[dependencies]` section, add:

```toml
aes-gcm = "0.10"
argon2 = "0.5"
base64 = "0.22"
rand = "0.8"
```

**Step 2: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add aes-gcm, argon2, base64, rand dependencies"
```

---

### Task 2: Create crypto.rs with core primitives (TDD)

**Files:**
- Create: `src-tauri/src/crypto.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod crypto;`)

**Step 1: Write the failing tests first**

Create `src-tauri/src/crypto.rs` with tests only:

```rust
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine};

const NONCE_LEN: usize = 12;

pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

pub fn encrypt(key_bytes: &[u8; 32], plaintext: &str) -> Result<String, String> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(B64.encode(&combined))
}

pub fn decrypt(key_bytes: &[u8; 32], encoded: &str) -> Result<String, String> {
    let combined = B64.decode(encoded).map_err(|e| e.to_string())?;
    if combined.len() < NONCE_LEN {
        return Err("ciphertext too short".to_string());
    }
    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "decryption failed: wrong key or corrupted data".to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key_is_deterministic() {
        let salt = b"testsalt12345678";
        let key1 = derive_key("mypassword", salt).unwrap();
        let key2 = derive_key("mypassword", salt).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_derive_key_differs_by_password() {
        let salt = b"testsalt12345678";
        let key1 = derive_key("password1", salt).unwrap();
        let key2 = derive_key("password2", salt).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = derive_key("secret", b"testsalt12345678").unwrap();
        let original = "Today I felt happy.";
        let encrypted = encrypt(&key, original).unwrap();
        let decrypted = decrypt(&key, &encrypted).unwrap();
        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_encrypt_produces_different_ciphertext_each_time() {
        let key = derive_key("secret", b"testsalt12345678").unwrap();
        let c1 = encrypt(&key, "hello").unwrap();
        let c2 = encrypt(&key, "hello").unwrap();
        assert_ne!(c1, c2); // different nonces each time
    }

    #[test]
    fn test_decrypt_fails_with_wrong_key() {
        let key1 = derive_key("correct", b"testsalt12345678").unwrap();
        let key2 = derive_key("wrong", b"testsalt12345678").unwrap();
        let encrypted = encrypt(&key1, "secret journal entry").unwrap();
        let result = decrypt(&key2, &encrypted);
        assert!(result.is_err());
    }
}
```

**Step 2: Add `mod crypto;` to lib.rs**

In `src-tauri/src/lib.rs`, add after the existing `mod` declarations:

```rust
mod crypto;
```

**Step 3: Run tests to verify they pass**

```bash
cd src-tauri && cargo test crypto
```

Expected: 5 tests pass.

**Step 4: Commit**

```bash
git add src-tauri/src/crypto.rs src-tauri/src/lib.rs
git commit -m "feat: add AES-256-GCM crypto primitives with tests"
```

---

### Task 3: Add DB-level crypto operations to crypto.rs (TDD)

**Files:**
- Modify: `src-tauri/src/crypto.rs`

**Step 1: Write failing tests for DB operations**

Add these tests inside the `#[cfg(test)]` block in `crypto.rs`:

```rust
    async fn test_pool() -> sqlx::SqlitePool {
        let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_setup_and_unlock() {
        let pool = test_pool().await;
        let key = setup_password(&pool, "mypassword", "1234").await.unwrap();
        assert_eq!(key.len(), 32);
        let unlocked = verify_and_get_key(&pool, "mypassword").await.unwrap();
        assert_eq!(key, unlocked);
    }

    #[tokio::test]
    async fn test_wrong_password_fails() {
        let pool = test_pool().await;
        setup_password(&pool, "mypassword", "1234").await.unwrap();
        let result = verify_and_get_key(&pool, "wrongpassword").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_pin_recovery() {
        let pool = test_pool().await;
        let original_key = setup_password(&pool, "original", "9999").await.unwrap();
        let recovered_key = recover_with_pin(&pool, "9999", "newpassword").await.unwrap();
        assert_eq!(original_key, recovered_key);
        // New password should now unlock
        let unlocked = verify_and_get_key(&pool, "newpassword").await.unwrap();
        assert_eq!(original_key, unlocked);
    }

    #[tokio::test]
    async fn test_wrong_pin_fails_recovery() {
        let pool = test_pool().await;
        setup_password(&pool, "password", "1234").await.unwrap();
        let result = recover_with_pin(&pool, "9999", "newpassword").await;
        assert!(result.is_err());
    }
```

**Step 2: Run to confirm they fail**

```bash
cd src-tauri && cargo test crypto::tests::test_setup_and_unlock
```

Expected: compile error — `setup_password`, `verify_and_get_key`, `recover_with_pin` don't exist yet.

**Step 3: Implement the DB operations**

Add these functions to `crypto.rs` (before the `#[cfg(test)]` block):

```rust
use sqlx::SqlitePool;
use rand::RngCore;

async fn get_config(pool: &SqlitePool, key: &str) -> Result<Option<String>, String> {
    sqlx::query_scalar::<_, String>("SELECT value FROM config WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())
}

async fn set_config(pool: &SqlitePool, key: &str, value: &str) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)")
        .bind(key)
        .bind(value)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn encrypt_existing_entries(pool: &SqlitePool, key: &[u8; 32]) -> Result<(), String> {
    let entries: Vec<(String, String)> =
        sqlx::query_as("SELECT id, content FROM journal_entries WHERE deleted_at IS NULL")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

    for (id, content) in entries {
        let encrypted = encrypt(key, &content)?;
        sqlx::query("UPDATE journal_entries SET content = ? WHERE id = ?")
            .bind(&encrypted)
            .bind(&id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// First-time setup: derive keys, store encrypted key blobs, encrypt existing entries.
/// Returns the content_key so the caller can put it in AppState.
pub async fn setup_password(
    pool: &SqlitePool,
    password: &str,
    pin: &str,
) -> Result<[u8; 32], String> {
    let mut salt_password = [0u8; 16];
    let mut salt_pin = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt_password);
    rand::thread_rng().fill_bytes(&mut salt_pin);

    let password_key = derive_key(password, &salt_password)?;
    let pin_key = derive_key(pin, &salt_pin)?;

    let mut content_key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut content_key);

    let content_key_b64 = B64.encode(&content_key);
    let enc_by_password = encrypt(&password_key, &content_key_b64)?;
    let enc_by_pin = encrypt(&pin_key, &content_key_b64)?;

    set_config(pool, "argon2_salt_password", &B64.encode(&salt_password)).await?;
    set_config(pool, "argon2_salt_pin", &B64.encode(&salt_pin)).await?;
    set_config(pool, "journal_key_enc_by_password", &enc_by_password).await?;
    set_config(pool, "journal_key_enc_by_pin", &enc_by_pin).await?;
    set_config(pool, "journal_lock_enabled", "true").await?;

    encrypt_existing_entries(pool, &content_key).await?;

    Ok(content_key)
}

/// Verify password and return the content_key. Fails if password is wrong.
pub async fn verify_and_get_key(pool: &SqlitePool, password: &str) -> Result<[u8; 32], String> {
    let salt_b64 = get_config(pool, "argon2_salt_password")
        .await?
        .ok_or("journal lock not set up")?;
    let salt = B64.decode(&salt_b64).map_err(|e| e.to_string())?;
    let password_key = derive_key(password, &salt)?;

    let enc_content_key = get_config(pool, "journal_key_enc_by_password")
        .await?
        .ok_or("encrypted key not found")?;
    let content_key_b64 = decrypt(&password_key, &enc_content_key)?;
    let content_key_bytes = B64.decode(&content_key_b64).map_err(|e| e.to_string())?;

    let mut key = [0u8; 32];
    key.copy_from_slice(&content_key_bytes);
    Ok(key)
}

/// Recover using PIN, reset password, return content_key.
pub async fn recover_with_pin(
    pool: &SqlitePool,
    pin: &str,
    new_password: &str,
) -> Result<[u8; 32], String> {
    let salt_b64 = get_config(pool, "argon2_salt_pin")
        .await?
        .ok_or("pin salt not found")?;
    let salt = B64.decode(&salt_b64).map_err(|e| e.to_string())?;
    let pin_key = derive_key(pin, &salt)?;

    let enc_by_pin = get_config(pool, "journal_key_enc_by_pin")
        .await?
        .ok_or("pin-encrypted key not found")?;
    let content_key_b64 = decrypt(&pin_key, &enc_by_pin)?;
    let content_key_bytes = B64.decode(&content_key_b64).map_err(|e| e.to_string())?;
    let mut content_key = [0u8; 32];
    content_key.copy_from_slice(&content_key_bytes);

    // Re-encrypt the content key under the new password
    let mut new_salt = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut new_salt);
    let new_password_key = derive_key(new_password, &new_salt)?;
    let new_enc = encrypt(&new_password_key, &content_key_b64)?;

    set_config(pool, "argon2_salt_password", &B64.encode(&new_salt)).await?;
    set_config(pool, "journal_key_enc_by_password", &new_enc).await?;

    Ok(content_key)
}
```

**Step 4: Run all crypto tests**

```bash
cd src-tauri && cargo test crypto
```

Expected: 9 tests pass.

**Step 5: Commit**

```bash
git add src-tauri/src/crypto.rs
git commit -m "feat: add DB-level crypto operations (setup, unlock, recover)"
```

---

### Task 4: Add journal_key to AppState

**Files:**
- Modify: `src-tauri/src/lib.rs`

**Step 1: Update AppState struct**

Change the `AppState` definition:

```rust
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub device_id: String,
    pub journal_key: std::sync::Mutex<Option<[u8; 32]>>,
}
```

**Step 2: Update AppState construction in `run()`**

Change `app.manage(AppState { db: pool, device_id });` to:

```rust
app.manage(AppState {
    db: pool,
    device_id,
    journal_key: std::sync::Mutex::new(None),
});
```

**Step 3: Verify it compiles**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: add journal_key to AppState for in-memory key storage"
```

---

### Task 5: Update journal.rs to encrypt/decrypt content

**Files:**
- Modify: `src-tauri/src/journal.rs`

**Step 1: Write failing tests**

Add these tests to the `#[cfg(test)]` block in `journal.rs`:

```rust
    #[tokio::test]
    async fn test_entry_content_encrypted_at_rest() {
        let pool = test_pool().await;
        let key = crate::crypto::setup_password(&pool, "pass", "1234").await.unwrap();
        let entry = create_entry(&pool, "Private thoughts", "device-a", Some(&key)).await.unwrap();

        // Content in DB should NOT be the original plaintext
        let raw: String = sqlx::query_scalar(
            "SELECT content FROM journal_entries WHERE id = ?"
        )
        .bind(&entry.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_ne!(raw, "Private thoughts");
        // But the returned entry should be decrypted
        assert_eq!(entry.content, "Private thoughts");
    }

    #[tokio::test]
    async fn test_list_entries_decrypted() {
        let pool = test_pool().await;
        let key = crate::crypto::setup_password(&pool, "pass", "1234").await.unwrap();
        create_entry(&pool, "Entry one", "device-a", Some(&key)).await.unwrap();
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let entries = list_entries_for_date(&pool, &today, Some(&key)).await.unwrap();
        assert_eq!(entries[0].content, "Entry one");
    }
```

**Step 2: Run tests to confirm they fail**

```bash
cd src-tauri && cargo test journal
```

Expected: compile errors — `create_entry` and `list_entries_for_date` don't take a `key` parameter yet.

**Step 3: Update all four journal functions**

Replace the signatures and bodies in `journal.rs`. Add `use crate::crypto;` at the top.

Update `create_entry`:

```rust
pub async fn create_entry(
    pool: &SqlitePool,
    content: &str,
    device_id: &str,
    key: Option<&[u8; 32]>,
) -> Result<JournalEntry, sqlx::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    let date = chrono::Utc::now().format("%Y-%m-%d").to_string();

    let stored_content = match key {
        Some(k) => crypto::encrypt(k, content)
            .map_err(|e| sqlx::Error::Protocol(e))?,
        None => content.to_string(),
    };

    sqlx::query(
        "INSERT INTO journal_entries (id, content, date, created_at, device_id, updated_at, locked)
         VALUES (?, ?, ?, ?, ?, ?, 0)",
    )
    .bind(&id)
    .bind(&stored_content)
    .bind(&date)
    .bind(now)
    .bind(device_id)
    .bind(now)
    .execute(pool)
    .await?;

    get_entry(pool, &id, key).await
}
```

Update `get_entry`:

```rust
pub async fn get_entry(
    pool: &SqlitePool,
    id: &str,
    key: Option<&[u8; 32]>,
) -> Result<JournalEntry, sqlx::Error> {
    let mut entry = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE id = ? AND deleted_at IS NULL",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    if let Some(k) = key {
        entry.content = crypto::decrypt(k, &entry.content)
            .map_err(|e| sqlx::Error::Protocol(e))?;
    }
    Ok(entry)
}
```

Update `list_entries_for_date`:

```rust
pub async fn list_entries_for_date(
    pool: &SqlitePool,
    date: &str,
    key: Option<&[u8; 32]>,
) -> Result<Vec<JournalEntry>, sqlx::Error> {
    let mut entries = sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE date = ? AND deleted_at IS NULL ORDER BY created_at ASC",
    )
    .bind(date)
    .fetch_all(pool)
    .await?;

    if let Some(k) = key {
        for entry in entries.iter_mut() {
            entry.content = crypto::decrypt(k, &entry.content)
                .map_err(|e| sqlx::Error::Protocol(e))?;
        }
    }
    Ok(entries)
}
```

Update `update_entry`:

```rust
pub async fn update_entry(
    pool: &SqlitePool,
    id: &str,
    content: &str,
    key: Option<&[u8; 32]>,
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp_millis();
    let locked: Option<bool> =
        sqlx::query_scalar("SELECT locked FROM journal_entries WHERE id = ? AND deleted_at IS NULL")
            .bind(id)
            .fetch_optional(pool)
            .await?;

    match locked {
        None => return Err(sqlx::Error::RowNotFound),
        Some(true) => return Err(sqlx::Error::RowNotFound),
        Some(false) => {}
    }

    let stored_content = match key {
        Some(k) => crypto::encrypt(k, content)
            .map_err(|e| sqlx::Error::Protocol(e))?,
        None => content.to_string(),
    };

    sqlx::query("UPDATE journal_entries SET content = ?, updated_at = ? WHERE id = ?")
        .bind(&stored_content)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
```

Also update the existing tests to pass `None` for the key:

```rust
// In existing tests, change:
create_entry(&pool, "Today I learned Rust", "device-a").await.unwrap();
// To:
create_entry(&pool, "Today I learned Rust", "device-a", None).await.unwrap();
```

Do the same for all other existing test calls to `create_entry`, `update_entry`, `list_entries_for_date`.

**Step 4: Run tests**

```bash
cd src-tauri && cargo test journal
```

Expected: all tests pass (existing + new encryption tests).

**Step 5: Commit**

```bash
git add src-tauri/src/journal.rs
git commit -m "feat: encrypt/decrypt journal entry content with optional key"
```

---

### Task 6: Add new Tauri commands for lock management

**Files:**
- Modify: `src-tauri/src/commands/journal.rs`
- Modify: `src-tauri/src/lib.rs` (register new commands + fix existing ones)

**Step 1: Update existing commands to pass key from AppState**

Replace the entire contents of `src-tauri/src/commands/journal.rs`:

```rust
use crate::{crypto, journal, AppState};
use tauri::State;

fn get_key(state: &AppState) -> Option<[u8; 32]> {
    *state.journal_key.lock().unwrap()
}

#[tauri::command]
pub async fn cmd_create_journal_entry(
    state: State<'_, AppState>,
    content: String,
) -> Result<journal::JournalEntry, String> {
    let key = get_key(&state);
    journal::create_entry(&state.db, &content, &state.device_id, key.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_list_journal_entries(
    state: State<'_, AppState>,
    date: String,
) -> Result<Vec<journal::JournalEntry>, String> {
    let key = get_key(&state);
    journal::list_entries_for_date(&state.db, &date, key.as_ref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_update_journal_entry(
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<(), String> {
    let key = get_key(&state);
    journal::update_entry(&state.db, &id, &content, key.as_ref())
        .await
        .map_err(|_| "Cannot edit a locked entry".to_string())
}

#[tauri::command]
pub async fn cmd_is_journal_locked(state: State<'_, AppState>) -> Result<bool, String> {
    let enabled = sqlx::query_scalar::<_, String>(
        "SELECT value FROM config WHERE key = 'journal_lock_enabled'",
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(enabled.as_deref() == Some("true"))
}

#[tauri::command]
pub async fn cmd_setup_journal_password(
    state: State<'_, AppState>,
    password: String,
    pin: String,
) -> Result<(), String> {
    let key = crypto::setup_password(&state.db, &password, &pin).await?;
    *state.journal_key.lock().unwrap() = Some(key);
    Ok(())
}

#[tauri::command]
pub async fn cmd_unlock_journal(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, String> {
    match crypto::verify_and_get_key(&state.db, &password).await {
        Ok(key) => {
            *state.journal_key.lock().unwrap() = Some(key);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn cmd_lock_journal(state: State<'_, AppState>) -> Result<(), String> {
    *state.journal_key.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub async fn cmd_recover_journal(
    state: State<'_, AppState>,
    pin: String,
    new_password: String,
) -> Result<bool, String> {
    match crypto::recover_with_pin(&state.db, &pin, &new_password).await {
        Ok(key) => {
            *state.journal_key.lock().unwrap() = Some(key);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}
```

**Step 2: Register new commands in lib.rs**

In `src-tauri/src/lib.rs`, update the `invoke_handler` to add the new commands:

```rust
commands::journal::cmd_is_journal_locked,
commands::journal::cmd_setup_journal_password,
commands::journal::cmd_unlock_journal,
commands::journal::cmd_lock_journal,
commands::journal::cmd_recover_journal,
```

**Step 3: Compile check**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

**Step 4: Run all tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src-tauri/src/commands/journal.rs src-tauri/src/lib.rs
git commit -m "feat: add journal lock/unlock/setup/recover Tauri commands"
```

---

### Task 7: Update journal store (TypeScript)

**Files:**
- Modify: `src/lib/stores/journal.ts`

**Step 1: Add new invoke functions**

Replace the contents of `src/lib/stores/journal.ts`:

```typescript
import { writable } from 'svelte/store';
import { invoke } from '$lib/tauri';

export interface JournalEntry {
  id: string;
  content: string;
  date: string;
  created_at: number;
  device_id: string;
  locked: boolean;
}

export const currentDateEntries = writable<JournalEntry[]>([]);

export async function loadEntriesForDate(date: string) {
  const entries = await invoke<JournalEntry[]>('cmd_list_journal_entries', { date });
  currentDateEntries.set(entries);
}

export async function addEntry(content: string) {
  await invoke('cmd_create_journal_entry', { content });
  const today = new Date().toISOString().split('T')[0];
  await loadEntriesForDate(today);
}

export async function isJournalLocked(): Promise<boolean> {
  return invoke<boolean>('cmd_is_journal_locked');
}

export async function setupJournalPassword(password: string, pin: string): Promise<void> {
  return invoke('cmd_setup_journal_password', { password, pin });
}

export async function unlockJournal(password: string): Promise<boolean> {
  return invoke<boolean>('cmd_unlock_journal', { password });
}

export async function lockJournal(): Promise<void> {
  return invoke('cmd_lock_journal');
}

export async function recoverJournal(pin: string, newPassword: string): Promise<boolean> {
  return invoke<boolean>('cmd_recover_journal', { pin, newPassword: new_password });
}
```

Wait — Tauri serializes camelCase from TS to snake_case in Rust automatically when using `serde`. Double-check: in the command `cmd_recover_journal(pin: String, new_password: String)`, invoke from TS as `{ pin, new_password }` (snake_case to match Rust param names):

```typescript
export async function recoverJournal(pin: string, newPassword: string): Promise<boolean> {
  return invoke<boolean>('cmd_recover_journal', { pin, new_password: newPassword });
}
```

**Step 2: TypeScript check**

```bash
npm run check
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/lib/stores/journal.ts
git commit -m "feat: add journal lock/unlock/setup/recover store functions"
```

---

### Task 8: Update journal page UI

**Files:**
- Modify: `src/routes/journal/+page.svelte`

**Step 1: Scaffold the page with lock/setup/entries views**

Replace `src/routes/journal/+page.svelte` with the following. Note the `TODO(human)` section — that's where you'll implement the form submission logic:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentDateEntries, loadEntriesForDate } from '$lib/stores/journal';
  import {
    isJournalLocked,
    setupJournalPassword,
    unlockJournal,
    lockJournal,
    recoverJournal,
  } from '$lib/stores/journal';
  import JournalEntryForm from '$lib/components/JournalEntryForm.svelte';

  type View = 'loading' | 'setup' | 'locked' | 'recover' | 'unlocked';

  let view: View = 'loading';
  const today = new Date().toISOString().split('T')[0];

  // Setup form
  let setupPassword = '';
  let setupConfirm = '';
  let setupPin = '';
  let setupError = '';

  // Unlock form
  let unlockPassword = '';
  let unlockError = '';

  // Recover form
  let recoverPin = '';
  let recoverNewPassword = '';
  let recoverError = '';

  onMount(async () => {
    const locked = await isJournalLocked();
    view = locked ? 'locked' : 'setup';
  });

  onDestroy(async () => {
    await lockJournal();
  });

  // TODO(human): Implement handleSetup, handleUnlock, and handleRecover below.
  //
  // handleSetup(e: SubmitEvent): called when the setup form is submitted.
  //   - Validate: setupPassword must equal setupConfirm, setupPin must be numeric
  //   - Call setupJournalPassword(setupPassword, setupPin)
  //   - On success: set view = 'unlocked', load entries for today
  //   - On error: set setupError to a user-friendly message
  //
  // handleUnlock(e: SubmitEvent): called when the unlock form is submitted.
  //   - Call unlockJournal(unlockPassword)
  //   - If true: set view = 'unlocked', load entries for today
  //   - If false: set unlockError = 'Incorrect password'
  //
  // handleRecover(e: SubmitEvent): called when the recover form is submitted.
  //   - Call recoverJournal(recoverPin, recoverNewPassword)
  //   - If true: set view = 'unlocked', load entries for today
  //   - If false: set recoverError = 'Incorrect PIN'
</script>

{#if view === 'loading'}
  <div class="auth-container"><p class="muted">Loading...</p></div>

{:else if view === 'setup'}
  <div class="auth-container">
    <h2 class="section-heading">Protect your journal</h2>
    <p class="muted">Set a password to encrypt your entries. Add a PIN to recover access if you forget.</p>
    <form on:submit|preventDefault={handleSetup} class="auth-form">
      <input type="password" placeholder="Password" bind:value={setupPassword} />
      <input type="password" placeholder="Confirm password" bind:value={setupConfirm} />
      <input type="text" inputmode="numeric" placeholder="Recovery PIN (numbers only)" bind:value={setupPin} />
      {#if setupError}<p class="error">{setupError}</p>{/if}
      <button type="submit" class="btn-primary">Enable journal lock</button>
    </form>
  </div>

{:else if view === 'locked'}
  <div class="auth-container">
    <h2 class="section-heading">Journal locked</h2>
    <form on:submit|preventDefault={handleUnlock} class="auth-form">
      <input type="password" placeholder="Enter password" bind:value={unlockPassword} />
      {#if unlockError}<p class="error">{unlockError}</p>{/if}
      <button type="submit" class="btn-primary">Unlock</button>
    </form>
    <button class="btn-link" on:click={() => view = 'recover'}>Forgot password?</button>
  </div>

{:else if view === 'recover'}
  <div class="auth-container">
    <h2 class="section-heading">Recover access</h2>
    <form on:submit|preventDefault={handleRecover} class="auth-form">
      <input type="text" inputmode="numeric" placeholder="Recovery PIN" bind:value={recoverPin} />
      <input type="password" placeholder="New password" bind:value={recoverNewPassword} />
      {#if recoverError}<p class="error">{recoverError}</p>{/if}
      <button type="submit" class="btn-primary">Reset password</button>
    </form>
    <button class="btn-link" on:click={() => view = 'locked'}>Back</button>
  </div>

{:else}
  <div class="journal-page">
    <h2 class="section-heading">{today}</h2>
    <JournalEntryForm />
    <div class="entries">
      {#each $currentDateEntries as entry (entry.id)}
        <div class="entry-card" class:locked={entry.locked}>
          <div class="entry-header">
            <time class="entry-time">
              {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
            {#if entry.locked}
              <span class="locked-badge">Locked</span>
            {/if}
          </div>
          <p class="entry-content">{entry.content}</p>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .auth-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 48px;
    gap: 12px;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 320px;
  }

  .auth-form input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
  }

  .btn-primary {
    padding: 10px;
    background: var(--accent);
    color: var(--accent-text, white);
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
    margin-top: 4px;
  }

  .error {
    font-size: 13px;
    color: var(--error, #e05);
  }

  .muted {
    color: var(--text-muted);
    font-size: 14px;
  }

  /* Existing entry card styles */
  .journal-page {
    display: flex;
    flex-direction: column;
    padding-top: 16px;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .entry-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 14px;
    box-shadow: var(--shadow);
  }

  .entry-card.locked {
    opacity: 0.7;
    border-style: dashed;
  }

  .entry-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .entry-time {
    font-size: 12px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .locked-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    padding: 1px 7px;
    border-radius: 99px;
  }

  .entry-content {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text);
    white-space: pre-wrap;
  }
</style>
```

**Step 2: TypeScript check**

```bash
npm run check
```

Expected: error — `handleSetup`, `handleUnlock`, `handleRecover` are referenced but not defined. This is expected — the TODO(human) section needs to be filled in.

**Step 3: Human contribution — implement the three handlers (see Learn by Doing request)**

**Step 4: After contribution — TypeScript check**

```bash
npm run check
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/routes/journal/+page.svelte src/lib/stores/journal.ts
git commit -m "feat: add journal lock/setup/recover UI"
```

---

### Task 9: Smoke test end-to-end

**Step 1: Run Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all tests pass.

**Step 2: Start dev app**

```bash
npm run tauri dev
```

Expected: app opens. Navigate to journal — setup screen appears. Set a password + PIN. Entries load. Leave journal and return — lock screen appears. Enter password — entries load.

**Step 3: Final commit**

No code changes — just verify everything works.
