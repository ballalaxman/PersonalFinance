/**
 * Cryptographic utilities for FinTrack auth.
 * Uses the Web Crypto API — available natively in Cloudflare Workers.
 * No external dependencies.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function base64ToBuf(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return bufToBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(str: string): Uint8Array {
  // Restore padding
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return base64ToBuf(padded)
}

// ─── Password hashing (PBKDF2) ───────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const SALT_BYTES = 16

/**
 * Hash a plaintext password. Returns a self-contained string:
 *   "pbkdf2:<iterations>:<saltBase64>:<hashBase64>"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    keyMaterial,
    256
  )
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufToBase64(salt.buffer)}:${bufToBase64(hashBuf)}`
}

/**
 * Verify a plaintext password against a stored hash string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

  const iterations = parseInt(parts[1], 10)
  const salt = base64ToBuf(parts[2])
  const expectedHash = base64ToBuf(parts[3])

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hashBuf = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    256
  )
  const actual = new Uint8Array(hashBuf)

  // Constant-time comparison
  if (actual.length !== expectedHash.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expectedHash[i]
  return diff === 0
}

// ─── JWT (HMAC-SHA256) ───────────────────────────────────────────────────────

export interface JWTPayload {
  sub: string   // userId
  email: string
  name: string
  iat: number
  exp: number
}

const JWT_HEADER_B64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).buffer)

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Sign a JWT. Returns the compact token string.
 * Default expiry: 7 days.
 */
export async function signJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: JWTPayload = { ...payload, iat: now, exp: now + expiresInSeconds }

  const headerAndPayload =
    JWT_HEADER_B64 +
    '.' +
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(fullPayload)).buffer)

  const key = await importHmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(headerAndPayload))

  return headerAndPayload + '.' + base64UrlEncode(sig)
}

/**
 * Verify and decode a JWT. Returns the payload or null if invalid/expired.
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, payloadB64, sigB64] = parts
  const key = await importHmacKey(secret)

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(sigB64).buffer as ArrayBuffer,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  )
  if (!valid) return null

  let payload: JWTPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)))
  } catch {
    return null
  }

  if (Math.floor(Date.now() / 1000) > payload.exp) return null

  return payload
}
