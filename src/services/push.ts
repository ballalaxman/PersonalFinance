import { api } from './api'

function decodeBase64Url(value: string): ArrayBuffer {
  const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const decoded = atob(padded)
  const buffer = new ArrayBuffer(decoded.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index)
  return buffer
}

export const pushService = {
  async enable(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Push notifications are not supported')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notification permission was not granted')
    const { publicKey } = await api.get<{ publicKey: string | null }>('/api/push/config')
    if (!publicKey) throw new Error('Push notifications are not configured on the server')
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(publicKey) })
    const json = subscription.toJSON()
    await api.post('/api/push/subscribe', { endpoint: subscription.endpoint, keys: json.keys, deviceLabel: navigator.userAgent.slice(0, 100) })
  },
  async disable(): Promise<void> {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    await api.delete('/api/push/subscribe', { endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  },
}
