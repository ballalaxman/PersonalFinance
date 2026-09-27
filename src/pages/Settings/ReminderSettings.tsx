import React, { useEffect, useState } from 'react'
import { Bell, BellOff, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { useAppStore } from '@/store/appStore'
import { pushService, pushSupported } from '@/services/push'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 06:00–23:00

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm'
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${suffix}`
}

function HourSelect({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Select value={value === null ? 'off' : String(value)} onValueChange={(v) => onChange(v === 'off' ? null : Number(v))}>
      <SelectTrigger id={id} label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="off">Off</SelectItem>
        {HOURS.map((h) => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function ReminderSettings() {
  const { state, updateSettings } = useAppStore()
  const settings = state?.settings
  const supported = pushSupported()
  const [subscribed, setSubscribed] = useState(false)
  const [status, setStatus] = useState<{ configured: boolean; devices: number } | null>(null)
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null)

  const refresh = async () => {
    setSubscribed(await pushService.isSubscribed())
    setStatus(await pushService.status().catch(() => null))
  }
  useEffect(() => { void refresh() }, [])

  const run = async (action: 'enable' | 'disable' | 'test') => {
    setBusy(action)
    try {
      if (action === 'enable') { await pushService.enable(); toast.success('Reminders turned on for this device') }
      if (action === 'disable') { await pushService.disable(); toast.success('Reminders turned off for this device') }
      if (action === 'test') { const r = await pushService.test(); toast.success(`Test sent to ${r.sent} device${r.sent === 1 ? '' : 's'}`) }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  const saveHour = async (key: 'reminderHour' | 'habitReminderHour', value: number | null) => {
    try { await updateSettings({ [key]: value }); toast.success(value === null ? 'Reminder turned off' : `Reminder set for ${hourLabel(value)}`) } catch { /* store shows the error */ }
  }

  const deviceState = !supported ? 'Not supported here' : subscribed ? 'On for this device' : 'Off for this device'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4 text-violet-600" aria-hidden="true" />Reminders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Get a notification when a recurring bill is coming up or needs confirming, and an evening nudge for habits you haven't done yet.
          Notifications show names only, never amounts or accounts. Times use your timezone ({settings?.timezone ?? 'not set'}).
        </p>

        {status && !status.configured && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Reminders aren't configured on the server yet (missing VAPID keys).</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={subscribed ? 'success' : 'secondary'}>{deviceState}</Badge>
          {status && status.devices > 0 && (
            <span className="text-xs text-muted-foreground">{status.devices} device{status.devices === 1 ? '' : 's'} on this account</span>
          )}
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {subscribed ? (
            <Button variant="outline" loading={busy === 'disable'} onClick={() => run('disable')}><BellOff className="h-4 w-4" aria-hidden="true" />Turn off on this device</Button>
          ) : (
            <Button loading={busy === 'enable'} disabled={!supported} onClick={() => run('enable')}><Bell className="h-4 w-4" aria-hidden="true" />Turn on for this device</Button>
          )}
          <Button variant="outline" loading={busy === 'test'} disabled={!status?.devices} onClick={() => run('test')}><Send className="h-4 w-4" aria-hidden="true" />Send test notification</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <HourSelect id="bill-reminder-hour" label="Bill reminders" value={settings?.reminderHour ?? 9} onChange={(v) => saveHour('reminderHour', v)} />
          <HourSelect id="habit-reminder-hour" label="Habit nudge" value={settings?.habitReminderHour === undefined ? 20 : settings.habitReminderHour} onChange={(v) => saveHour('habitReminderHour', v)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Bill reminders cover items due or awaiting confirmation, plus advance notice set on each recurring schedule. The habit nudge only lists habits still open for today.
          On iPhone, add FinTrack to the Home Screen to receive notifications.
        </p>
      </CardContent>
    </Card>
  )
}
