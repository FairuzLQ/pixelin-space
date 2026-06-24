'use client'

const NICKNAME_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

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
  const nickname = localStorage.getItem('ps_nickname')
  const createdAt = localStorage.getItem('ps_nickname_created')
  if (!nickname) return null

  if (createdAt && Date.now() - parseInt(createdAt, 10) > NICKNAME_TTL) {
    localStorage.removeItem('ps_nickname')
    localStorage.removeItem('ps_nickname_created')
    localStorage.removeItem('ps_reactions')
    return null
  }
  return nickname
}

export function setNickname(name: string): void {
  localStorage.setItem('ps_nickname', name)
  localStorage.setItem('ps_nickname_created', Date.now().toString())
}

export function getNicknameExpiresAt(): Date | null {
  if (typeof window === 'undefined') return null
  const createdAt = localStorage.getItem('ps_nickname_created')
  if (!createdAt) return null
  return new Date(parseInt(createdAt, 10) + NICKNAME_TTL)
}
