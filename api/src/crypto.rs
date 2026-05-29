//! AES-256-GCM crypto that mirrors the TS web/src/lib/crypto.ts
//! layout (nonce || ciphertext || tag). The web side is the primary
//! encryptor; the Rust side decrypts to invoke provider APIs without
//! round-tripping the plaintext through the web container, and
//! re-encrypts when the runtime itself mints new secrets (e.g. a
//! refreshed native-MCP OAuth token).

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use anyhow::{anyhow, Context};
use base64::{engine::general_purpose::STANDARD, Engine as _};

const NONCE_LEN: usize = 12;
const TAG_LEN: usize = 16;
const KEY_LEN: usize = 32;

pub struct MasterKey(Key<Aes256Gcm>);

impl MasterKey {
    /// Load from the `TAS_ENCRYPTION_KEY` env var (32-byte base64).
    /// Same provenance as the web container's key.
    pub fn from_env() -> anyhow::Result<Self> {
        let raw = std::env::var("TAS_ENCRYPTION_KEY").context(
            "TAS_ENCRYPTION_KEY must be set so the run task can decrypt \
             workspace secrets",
        )?;
        let bytes = STANDARD
            .decode(raw.trim())
            .context("TAS_ENCRYPTION_KEY must be base64")?;
        if bytes.len() != KEY_LEN {
            return Err(anyhow!(
                "TAS_ENCRYPTION_KEY must decode to {} bytes (got {})",
                KEY_LEN,
                bytes.len()
            ));
        }
        let key = Key::<Aes256Gcm>::clone_from_slice(&bytes);
        Ok(Self(key))
    }

    /// Encrypt `plaintext` into the same `nonce || ciphertext || tag`
    /// layout the web side produces, so a blob written here is
    /// interchangeable with one written by crypto.ts. A fresh random
    /// 12-byte nonce is generated per call (AES-GCM is catastrophic on
    /// nonce reuse — never make this deterministic).
    pub fn encrypt(&self, plaintext: &str) -> anyhow::Result<Vec<u8>> {
        let cipher = Aes256Gcm::new(&self.0);
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| anyhow!("encrypt failed: {e}"))?;
        let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        out.extend_from_slice(nonce.as_slice());
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    pub fn decrypt(&self, blob: &[u8]) -> anyhow::Result<String> {
        if blob.len() < NONCE_LEN + TAG_LEN {
            return Err(anyhow!("encrypted blob shorter than nonce+tag"));
        }
        let cipher = Aes256Gcm::new(&self.0);
        let (nonce_bytes, body_and_tag) = blob.split_at(NONCE_LEN);
        let nonce = Nonce::from_slice(nonce_bytes);
        let plain = cipher
            .decrypt(nonce, body_and_tag)
            .map_err(|e| anyhow!("decrypt failed: {e}"))?;
        String::from_utf8(plain).context("decrypted bytes are not valid UTF-8")
    }
}
