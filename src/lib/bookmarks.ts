'use client'

// Saved posts live only in the browser — no server identity needed, and they
// naturally age out because posts themselves reset weekly.
const KEY = 'ps_saved'

export function getSaved(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

export function isSaved(id: string): boolean {
  return getSaved().includes(id)
}

/** Toggle and return the new saved state. */
export function toggleSaved(id: string): boolean {
  const s = getSaved()
  const i = s.indexOf(id)
  if (i >= 0) {
    s.splice(i, 1)
    localStorage.setItem(KEY, JSON.stringify(s))
    return false
  }
  s.unshift(id)
  localStorage.setItem(KEY, JSON.stringify(s))
  return true
}
