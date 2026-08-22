import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../index'
import { newId, now } from '../utils/id'

export const pushRoutes = new Hono<{ Bindings: Env }>()

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }),
  deviceLabel: z.string().max(100).optional(),
})

pushRoutes.get('/config', (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY ?? null }))

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
