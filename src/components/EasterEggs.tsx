'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'

// Hidden fun. Mounted once in the root layout.
//  1. A devtools console greeting + a `window.pixelin` toy (stars/party/help).
//  2. Konami code (↑↑↓↓←→←→ B A) → star rain.
//  3. Type "stars" or "party" anywhere (outside inputs) → stars / confetti.
//  4. The big ✷ on the 404 page (StarEgg) rains stars when clicked.
// Also listens for a custom 'pixelin:egg' window event so other components can
// trigger the rain.

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
]
const COLORS = ['#ff5a2c', '#d4f24a', '#ff5c9e', '#2f6bff', '#16130d']

function toast(msg: string) {
  const t = document.createElement('div')
  t.textContent = msg
  t.style.cssText =
    'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;' +
    'background:#d4f24a;color:#16130d;border:2.5px solid #16130d;box-shadow:4px 4px 0 #16130d;' +
    'padding:10px 16px;border-radius:12px;font:700 13px/1 var(--font-sans),sans-serif;pointer-events:none'
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2600)
}

export function starRain() {
  if (typeof document === 'undefined') return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const n = reduce ? 0 : 40
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div')
    s.textContent = Math.random() < 0.5 ? '✷' : '✦'
    s.style.cssText =
      `position:fixed;top:-40px;left:${Math.random() * 100}vw;z-index:99998;pointer-events:none;` +
      `font-size:${12 + Math.random() * 26}px;color:${COLORS[i % COLORS.length]}`
    document.body.appendChild(s)
    const dur = 2200 + Math.random() * 2200
    const anim = s.animate(
      [
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(110vh) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0.85 },
      ],
      { duration: dur, delay: Math.random() * 400, easing: 'cubic-bezier(.3,.1,.4,1)' },
    )
    anim.onfinish = () => s.remove()
  }
  toast('✷ you found the stars')
}

export function partyRain() {
  if (typeof document === 'undefined') return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const n = reduce ? 0 : 60
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div')
    const sz = 6 + Math.random() * 9
    c.style.cssText =
      `position:fixed;top:-24px;left:${Math.random() * 100}vw;z-index:99998;pointer-events:none;` +
      `width:${sz}px;height:${sz}px;background:${COLORS[i % COLORS.length]};border:1.5px solid #16130d`
    document.body.appendChild(c)
    const dur = 2400 + Math.random() * 2400
    const anim = c.animate(
      [
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(110vh) rotate(${Math.random() * 1080 - 540}deg)`, opacity: 0.9 },
      ],
      { duration: dur, delay: Math.random() * 300, easing: 'cubic-bezier(.3,.1,.4,1)' },
    )
    anim.onfinish = () => c.remove()
  }
  toast('🎉 party mode')
}

/** A clickable star that rains stars — used on the 404 page. */
export function StarEgg({ className, style, label, children }: {
  className?: string
  style?: CSSProperties
  label?: string
  children: ReactNode
}) {
  return (
    <button onClick={() => starRain()} className={className} style={style} aria-label={label ?? 'surprise'}>
      {children}
    </button>
  )
}

export default function EasterEggs() {
  useEffect(() => {
    console.log('%c✷ pixelin.space', 'font:700 22px var(--font-mono),monospace;color:#ff5a2c')
    console.log('%cpsst — nothing to hack here, it all resets weekly anyway. say hi 👋', 'color:#6a6252')
    console.log('%ctype pixelin.help() for tricks ✷', 'color:#2f6bff;font-weight:700')

    // expose a tiny console toy
    const w = window as unknown as { pixelin?: Record<string, () => void> }
    w.pixelin = {
      stars: starRain,
      party: partyRain,
      help: () => console.log(
        '%c✷ pixelin tricks\n%c• pixelin.stars()  — rain stars\n• pixelin.party()  — confetti\n• konami: ↑↑↓↓←→←→ B A\n• type "stars" or "party" anywhere',
        'color:#ff5a2c;font-weight:700', 'color:#16130d',
      ),
    }

    let idx = 0
    let buf = ''
    function onKey(e: KeyboardEvent) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      // konami code
      idx = k === KONAMI[idx] ? idx + 1 : (k === KONAMI[0] ? 1 : 0)
      if (idx === KONAMI.length) { idx = 0; starRain() }

      // typed secret words — but not while typing into a field
      const el = document.activeElement as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (!typing && /^[a-z]$/.test(k)) {
        buf = (buf + k).slice(-8)
        if (buf.endsWith('stars')) starRain()
        else if (buf.endsWith('party')) partyRain()
      }
    }
    function onEgg() { starRain() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pixelin:egg', onEgg)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pixelin:egg', onEgg)
      delete w.pixelin
    }
  }, [])

  return null
}
