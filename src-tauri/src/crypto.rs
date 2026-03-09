use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use sqlx::SqlitePool;

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

#[cfg(test)]
mod tests {
    use super::*;

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
