export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export function now(): string {
  return new Date().toISOString()
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}
