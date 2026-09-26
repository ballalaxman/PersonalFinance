import { api } from './api'

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return false
  const x = new Uint8Array(a)
  return x.length === b.length && x.every((v, i) => v === b[i])
}

/** The service worker is only registered in production builds (vite-plugin-pwa). */
async function serviceWorker(timeoutMs = 5000): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('The app\'s service worker isn\'t running. Reminders work in the installed or deployed app, not the dev server.')), timeoutMs))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export const pushService = {
  status: () => api.get<{ configured: boolean; devices: number }>('/api/push/status'),

  /** Whether this browser currently has a push subscription. */
  async isSubscribed(): Promise<boolean> {
    if (!pushSupported()) return false
    try {
      const registration = await serviceWorker(1500)
      return Boolean(await registration.pushManager.getSubscription())
    } catch {
      return false
    }
  },

  async enable(): Promise<void> {
    if (!pushSupported()) throw new Error('This browser doesn\'t support notifications. On iPhone, add FinTrack to the Home Screen first.')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in the browser\'s site settings.')
    const { publicKey } = await api.get<{ publicKey: string | null }>('/api/push/config')
    if (!publicKey) throw new Error('Push notifications are not configured on the server')
    const applicationServerKey = decodeBase64Url(publicKey)
    const registration = await serviceWorker()

    // A subscription made with an old server key can't receive messages; replace it.
    const existing = await registration.pushManager.getSubscription()
    if (existing && !sameKey(existing.options.applicationServerKey, applicationServerKey)) await existing.unsubscribe()

    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
    const json = subscription.toJSON()
    await api.post('/api/push/subscribe', { endpoint: subscription.endpoint, keys: json.keys, deviceLabel: navigator.userAgent.slice(0, 100) })
  },

  async disable(): Promise<void> {
    if (!pushSupported()) return
    const registration = await serviceWorker(1500).catch(() => null)
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await api.delete('/api/push/subscribe', { endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  },

  test: () => api.post<{ success: boolean; sent: number }>('/api/push/test', {}),
}
