import Link from 'next/link'
import React from 'react'

// Turns plain post/comment text into React nodes with clickable URLs and
// #hashtags. Rendered as real React children (never dangerouslySetInnerHTML),
// so user content stays auto-escaped and XSS-safe.
const TOKEN = /(https?:\/\/[^\s]+)|(#[\p{L}0-9_]{1,30})/gu

export function RichText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = []
  let last = 0
  let key = 0
  const re = new RegExp(TOKEN)
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))

    if (m[1]) {
      // URL — peel trailing punctuation so "(see https://x.com)." links cleanly
      let url = m[1]
      let trail = ''
      const tm = url.match(/[),.!?;:]+$/)
      if (tm) { trail = tm[0]; url = url.slice(0, url.length - trail.length) }
      nodes.push(
        <a key={key++} href={url} target="_blank" rel="noopener noreferrer nofollow ugc" className="linkified">
          {url}
        </a>,
      )
      if (trail) nodes.push(trail)
    } else if (m[2]) {
      const tag = m[2].slice(1)
      nodes.push(
        <Link key={key++} href={`/tag/${encodeURIComponent(tag.toLowerCase())}`} className="hashtag">
          #{tag}
        </Link>,
      )
    }
    last = m.index + m[0].length
  }

  if (last < text.length) nodes.push(text.slice(last))
  return <>{nodes}</>
}

/** Extract unique lowercased hashtags from a body of text. */
export function extractHashtags(text: string): string[] {
  const out = new Set<string>()
  const re = /#([\p{L}0-9_]{1,30})/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.add(m[1].toLowerCase())
  return [...out]
}
