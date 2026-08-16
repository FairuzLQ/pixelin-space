import { ImageResponse } from 'next/og'

export const alt = 'pixelin.space — a tiny anonymous space'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#f2ecdd',
          backgroundImage: 'radial-gradient(#16130d 2px, transparent 2px)',
          backgroundSize: '40px 40px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 120, height: 120, borderRadius: 28, background: '#ff5a2c',
              border: '8px solid #16130d', boxShadow: '12px 12px 0 #16130d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* a "pixel" mark drawn as a rotated square — avoids OG font fetch */}
            <div style={{ width: 48, height: 48, background: '#16130d', transform: 'rotate(45deg)', borderRadius: 8 }} />
          </div>
          <div style={{ fontSize: 96, fontWeight: 800, color: '#16130d', letterSpacing: '-4px' }}>
            pixelin.space
          </div>
        </div>
        <div
          style={{
            marginTop: 48, fontSize: 40, color: '#16130d', fontWeight: 700,
            background: '#d4f24a', border: '6px solid #16130d', boxShadow: '8px 8px 0 #16130d',
            padding: '16px 28px', alignSelf: 'flex-start', display: 'flex',
          }}
        >
          a tiny anonymous space · resets every week
        </div>
      </div>
    ),
    size,
  )
}
