/**
 * Web Push sender using only Web Crypto (no dependencies):
 *  - VAPID authentication (RFC 8292): an ES256 JWT signed with the server key.
 *  - Payload encryption (RFC 8291, "aes128gcm" content coding, RFC 8188).
 */

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string // base64url, 65-byte uncompressed P-256 point
  auth: string   // base64url, 16-byte secret
}

export interface VapidKeys {
  publicKey: string  // base64url, 65 bytes
  privateKey: string // base64url, 32 bytes (the "d" scalar)
  subject: string    // mailto: or https: contact for the push service
}

// Browsers' push services. Anything else is refused so a stored subscription
// can't make the Worker send requests to arbitrary hosts.
const PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
]

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOST_SUFFIXES.some((s) => url.hostname === s || url.hostname.endsWith(`.${s}`))
  } catch {
    return false
  }
}

// ─── Encoding helpers ────────────────────────────────────────────────────────

export function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.length }
  return out
}

const utf8 = (s: string) => new TextEncoder().encode(s)
const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8)
  return new Uint8Array(bits)
}

// ─── VAPID ───────────────────────────────────────────────────────────────────

async function importVapidPrivateKey(keys: VapidKeys): Promise<CryptoKey> {
  const pub = b64urlDecode(keys.publicKey)
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 key')
  const jwk: JsonWebKey = {
    kty: 'EC', crv: 'P-256', ext: false,
    d: keys.privateKey,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

/** `Authorization` header value for a push service origin. */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
  const header = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(utf8(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  })))
  const signingInput = `${header}.${claims}`
  const key = await importVapidPrivateKey(keys)
  // Web Crypto returns the raw r||s signature JWS expects.
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, buf(utf8(signingInput))))
  return `vapid t=${signingInput}.${b64urlEncode(signature)}, k=${keys.publicKey}`
}

// ─── Payload encryption (RFC 8291) ───────────────────────────────────────────

const RECORD_SIZE = 4096

export async function encryptPayload(
  payload: Uint8Array,
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  // Injectable for tests only
  options: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {}
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(subscription.p256dh)
  const authSecret = b64urlDecode(subscription.auth)
  if (uaPublic.length !== 65) throw new Error('Invalid p256dh key')
  if (authSecret.length !== 16) throw new Error('Invalid auth secret')
  // One record only: payload + 1 delimiter byte + 16-byte tag must fit
  if (payload.length > RECORD_SIZE - 17 - 86) throw new Error('Push payload too large')

  const serverKeys = options.serverKeys ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', buf(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverKeys.privateKey, 256))

  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt'])
  const padded = concat(payload, new Uint8Array([2])) // 0x02 marks the last record
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, aesKey, buf(padded)))

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

// ─── Send ────────────────────────────────────────────────────────────────────

export type PushResult =
  | { ok: true; status: number }
  | { ok: false; status: number; gone: boolean; error: string }

/**
 * Send one notification. `gone` means the subscription has expired or was
 * revoked (404/410) and should be deleted.
 */
export async function sendPush(
  subscription: PushSubscriptionKeys,
  message: unknown,
  keys: VapidKeys,
  options: { ttlSeconds?: number; urgency?: 'normal' | 'high'; topic?: string } = {}
): Promise<PushResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return { ok: false, status: 0, gone: true, error: 'Endpoint is not a recognised push service' }
  }
  const body = await encryptPayload(utf8(JSON.stringify(message)), subscription)
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(subscription.endpoint, keys),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttlSeconds ?? 12 * 60 * 60),
    Urgency: options.urgency ?? 'normal',
  }
  // Topic replaces an undelivered message with the same topic (max 32 url-safe chars)
  if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)

  const res = await fetch(subscription.endpoint, { method: 'POST', headers, body: buf(body) })
  if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status }
  const text = await res.text().catch(() => '')
  return { ok: false, status: res.status, gone: res.status === 404 || res.status === 410, error: text.slice(0, 200) || res.statusText }
}
