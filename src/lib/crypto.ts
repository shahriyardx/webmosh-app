import crypto from "crypto"

/**
 * AES-256-GCM encryption for secrets at rest (e.g. the Anthropic API key).
 *
 * The master secret lives ONLY in the server env var SETTINGS_ENCRYPTION_KEY —
 * the encrypted blobs in the database are useless without it. We SHA-256 the
 * secret to derive a fixed 32-byte key so any-length secret works.
 *
 * Stored format (base64): [ 12-byte IV | 16-byte auth tag | ciphertext ].
 */

function deriveKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is not configured on the server.")
  }
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

/** A safe-to-display preview like "sk-ant-••••••••1234" — never the real key. */
export function maskSecret(plain: string): string {
  const tail = plain.slice(-4)
  const prefix = plain.startsWith("sk-ant-") ? "sk-ant-" : "sk-"
  return `${prefix}••••••••${tail}`
}
