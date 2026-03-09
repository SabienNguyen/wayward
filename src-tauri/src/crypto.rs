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
