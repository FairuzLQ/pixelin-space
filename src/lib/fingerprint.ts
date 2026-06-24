'use client'

export function getFingerprint(): string {
  if (typeof window === 'undefined') return 'server'
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency ?? '',
  ].join('|')

  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function getNickname(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('ps_nickname')
}

export function setNickname(name: string): void {
  localStorage.setItem('ps_nickname', name)
}
