import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'boredgame.lol — Find Your Next Favorite Game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0a0a1a 0%, #12102e 40%, #0d1520 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle starfield dots */}
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              borderRadius: '50%',
              background: `rgba(255,255,255,${0.15 + (i % 5) * 0.08})`,
              top: `${(i * 73 + 17) % 100}%`,
              left: `${(i * 47 + 31) % 100}%`,
            }}
          />
        ))}

        Category labels
        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            fontSize: '16px',
            fontWeight: 600,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#FF6D3F',
          }}
        >
          <span>Board Games</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>&middot;</span>
          <span>Video Games</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>&middot;</span>
          <span>Word Games</span>
        </div>

        {/* Main headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1.1,
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#5B4FDB',
              marginBottom: '4px',
            }}
          >
            Find your next
          </div>
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              color: '#5B4FDB',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            favorite game
            {/* Teal underline accent */}
            <div
              style={{
                width: '100%',
                height: '5px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #0EC6C6, #5B4FDB)',
                marginTop: '8px',
              }}
            />
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            color: 'rgba(255,255,255,0.65)',
            marginTop: '28px',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
          }}
        >
          Tell us what you&apos;re in the mood for and we&apos;ll match you
          with something great from our catalog of 100,000+ games.
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '18px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          boredgame.lol
        </div>
      </div>
    ),
    { ...size },
  );
}
