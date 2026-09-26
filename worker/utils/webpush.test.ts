// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { b64urlDecode, b64urlEncode, encryptPayload, isAllowedPushEndpoint, sendPush, vapidAuthorization } from './webpush'

const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8))
}

/** Independent user-agent side of RFC 8291, used to check what the sender produces. */
async function decrypt(body: Uint8Array, uaKeys: CryptoKeyPair, authSecret: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16)
  const idlen = body[20]
  const asPublic = body.slice(21, 21 + idlen)
  const ciphertext = body.slice(21 + idlen)
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', uaKeys.publicKey) as ArrayBuffer)
  const asKey = await crypto.subtle.importKey('raw', buf(asPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaKeys.privateKey, 256))
  const enc = new TextEncoder()
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic])
  const ikm = await hkdf(authSecret, ecdh, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(nonce) }, key, buf(ciphertext)))
  expect(plain[plain.length - 1]).toBe(2) // last-record delimiter
  return new TextDecoder().decode(plain.slice(0, -1))
}

async function ecdhKeyFromRfc(publicB64: string, privateB64: string): Promise<CryptoKeyPair> {
  const pub = b64urlDecode(publicB64)
  const jwk = { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33)), ext: true }
  return {
    publicKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    privateKey: await crypto.subtle.importKey('jwk', { ...jwk, d: privateB64 }, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
  }
}

describe('encryptPayload', () => {
  it('produces a message the subscriber can decrypt', async () => {
    const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer)
    const auth = crypto.getRandomValues(new Uint8Array(16))
    const message = JSON.stringify({ title: 'Rent is due tomorrow', url: '/recurring' })

    const body = await encryptPayload(new TextEncoder().encode(message), { p256dh: b64urlEncode(uaPublic), auth: b64urlEncode(auth) })

    expect(new DataView(body.buffer).getUint32(16)).toBe(4096)
    expect(await decrypt(body, ua, auth)).toBe(message)
  })

  it('matches the RFC 8291 appendix A test vector', async () => {
    const serverKeys = await ecdhKeyFromRfc(
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    )
    const body = await encryptPayload(
      new TextEncoder().encode('When I grow up, I want to be a watermelon'),
      {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      { salt: b64urlDecode('DGv6ra1nlYgDCS1FRnbzlw'), serverKeys },
    )
    expect(b64urlEncode(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
    )
  })

  it('rejects malformed subscription keys', async () => {
    await expect(encryptPayload(new Uint8Array(1), { p256dh: 'AAAA', auth: 'AAAA' })).rejects.toThrow()
  })
})

async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey) as ArrayBuffer)
  return { pair, keys: { publicKey: b64urlEncode(pub), privateKey: jwk.d!, subject: 'mailto:owner@example.com' } }
}

describe('vapidAuthorization', () => {
  it('signs an ES256 JWT for the push service origin that verifies with the public key', async () => {
    const { pair, keys } = await vapidKeys()
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, Date.UTC(2026, 8, 27))
    const [, token, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!
    expect(k).toBe(keys.publicKey)
    const [h, c, s] = token.split('.')
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(c)))
    expect(claims).toMatchObject({ aud: 'https://fcm.googleapis.com', sub: 'mailto:owner@example.com' })
    expect(claims.exp).toBe(Date.UTC(2026, 8, 27) / 1000 + 12 * 3600)
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, buf(b64urlDecode(s)), buf(new TextEncoder().encode(`${h}.${c}`)))
    expect(ok).toBe(true)
  })
})

describe('isAllowedPushEndpoint', () => {
  it('accepts browser push services and refuses anything else', () => {
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/x')).toBe(true)
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true)
    expect(isAllowedPushEndpoint('https://web.push.apple.com/Q')).toBe(true)
    expect(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true)
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/x')).toBe(false)
    expect(isAllowedPushEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false)
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false)
    expect(isAllowedPushEndpoint('https://169.254.169.254/latest')).toBe(false)
  })
})

describe('sendPush', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts an encrypted body with VAPID and content-coding headers', async () => {
    const { keys } = await vapidKeys()
    const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer)
    const auth = crypto.getRandomValues(new Uint8Array(16))
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendPush({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: b64urlEncode(uaPublic), auth: b64urlEncode(auth) }, { title: 'Hi' }, keys, { topic: 'habits-2026-09-27' })

    expect(result.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/abc')
    expect(init.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', Topic: 'habits-2026-09-27' })
    expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=/)
    expect(await decrypt(new Uint8Array(init.body), ua, auth)).toBe('{"title":"Hi"}')
  })

  it('reports expired subscriptions as gone', async () => {
    const { keys } = await vapidKeys()
    const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair
    const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey) as ArrayBuffer)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('expired', { status: 410 })))
    const result = await sendPush({ endpoint: 'https://fcm.googleapis.com/x', p256dh: b64urlEncode(uaPublic), auth: b64urlEncode(new Uint8Array(16)) }, {}, keys)
    expect(result).toMatchObject({ ok: false, gone: true, status: 410 })
  })

  it('never contacts a non-push host', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { keys } = await vapidKeys()
    const result = await sendPush({ endpoint: 'https://example.com/hook', p256dh: 'x', auth: 'y' }, {}, keys)
    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
