import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { newId, now } from '../utils/id'
import { isAllowedPushEndpoint } from '../utils/webpush'
import { deliverToUser, vapidKeysFromEnv } from '../reminders'

export const pushRoutes = new Hono<{ Bindings: Env }>()

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine(isAllowedPushEndpoint, 'Unsupported push service'),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
  deviceLabel: z.string().max(100).optional(),
})

pushRoutes.get('/config', (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY ?? null }))

// GET /api/push/status — how many devices receive reminders for this account
pushRoutes.get('/status', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const row = await c.env.DB.prepare('SELECT COUNT(*) AS devices FROM push_subscriptions WHERE userId = ?1')
    .bind(userId).first<{ devices: number }>()
  return c.json({ configured: Boolean(vapidKeysFromEnv(c.env)), devices: Number(row?.devices ?? 0) })
})

pushRoutes.post('/subscribe', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const parsed = subscriptionSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid push subscription' }, 422)
  const ts = now()
  await c.env.DB.prepare(
    'INSERT INTO push_subscriptions (id,userId,endpoint,p256dh,auth,deviceLabel,createdAt,updatedAt) VALUES (?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(userId,endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,deviceLabel=excluded.deviceLabel,lastFailure=NULL,updatedAt=excluded.updatedAt'
  ).bind(newId(), userId, parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth,
    parsed.data.deviceLabel ?? '', ts, ts).run()
  return c.json({ success: true }, 201)
})

pushRoutes.delete('/subscribe', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const body = await c.req.json().catch(() => null) as { endpoint?: string } | null
  if (!body?.endpoint) return c.json({ error: 'Endpoint is required' }, 422)
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE userId=?1 AND endpoint=?2')
    .bind(userId, body.endpoint).run()
  return c.json({ success: true })
})

// POST /api/push/test — send a test notification to all of this user's devices
pushRoutes.post('/test', async (c) => {
  const { id: userId } = c.get('user' as never) as { id: string }
  const keys = vapidKeysFromEnv(c.env)
  if (!keys) return c.json({ error: 'Push notifications are not configured on the server' }, 503)
  const result = await deliverToUser(c.env, keys, userId, {
    title: 'FinTrack reminders are on',
    body: 'This device will get bill and habit reminders.',
    url: '/settings',
    tag: 'test',
  })
  if (result.sent === 0) {
    const reason = result.removed > 0 && result.failed === 0
      ? 'This device\'s subscription had expired and was removed. Turn reminders on again.'
      : result.failed > 0 ? 'The push service rejected the notification. Try turning reminders off and on again.' : 'No devices have reminders turned on.'
    return c.json({ error: reason, ...result }, 422)
  }
  return c.json({ success: true, ...result })
})
