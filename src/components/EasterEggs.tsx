'use client'

import { useEffect, type CSSProperties, type ReactNode } from 'react'

// Hidden fun. Mounted once in the root layout.
//  1. A friendly console greeting for anyone who opens devtools.
//  2. The Konami code (↑↑↓↓←→←→ B A) rains brutalist stars.
//  3. The big ✷ on the 404 page (StarEgg) rains stars when clicked.
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
    console.log(
      '%c✷ pixelin.space',
      'font:700 22px var(--font-mono),monospace;color:#ff5a2c',
    )
    console.log(
      '%cpsst — nothing to hack here, it all resets weekly anyway. say hi 👋 (there might be a cheat code…)',
      'color:#6a6252',
    )

    let idx = 0
    function onKey(e: KeyboardEvent) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      idx = k === KONAMI[idx] ? idx + 1 : (k === KONAMI[0] ? 1 : 0)
      if (idx === KONAMI.length) { idx = 0; starRain() }
    }
    function onEgg() { starRain() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pixelin:egg', onEgg)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pixelin:egg', onEgg)
    }
  }, [])

  return null
}
