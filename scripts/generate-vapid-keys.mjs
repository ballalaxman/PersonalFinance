// Prints a new VAPID key pair for Web Push. Run with `npm run vapid:generate`.
// Changing keys invalidates every existing browser subscription: users must
// turn reminders on again in Settings.
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d

console.log(`VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${privateKey}`)
console.log('\nProduction: npx wrangler secret put VAPID_PRIVATE_KEY   (paste the private key)')
console.log('            npx wrangler secret put VAPID_PUBLIC_KEY    (paste the public key)')
console.log('Local dev:  add both lines to .dev.vars')
