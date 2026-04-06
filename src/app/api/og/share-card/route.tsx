/**
 * GET /api/og/share-card — Generate a shareable social card image
 *
 * Query params:
 *   title  — Card title (e.g. "My Party Night Picks")
 *   games  — JSON-encoded array of { name, score?, types? }
 *   theme  — Optional color theme: "purple" (default), "orange", "teal"
 *
 * Returns a 1200x630 PNG rendered via Next.js ImageResponse (Edge).
 */

import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

interface CardGame {
  name: string;
  score?: number;
  types?: string[];
}

const THEMES = {
  purple: { accent: '#5B4FDB', gradient: 'linear-gradient(145deg, #0a0a1a 0%, #12102e 40%, #0d1520 100%)' },
  orange: { accent: '#FF6D3F', gradient: 'linear-gradient(145deg, #1a0a0a 0%, #2e1210 40%, #201510 100%)' },
  teal:   { accent: '#0EC6C6', gradient: 'linear-gradient(145deg, #0a1a1a 0%, #10202e 40%, #0d2020 100%)' },
} as const;

type ThemeKey = keyof typeof THEMES;

/** Map game type to a color for the dot indicator */
function typeColor(types?: string[]): string {
  if (!types?.length) return '#5B4FDB';
  const t = types[0];
  if (t === 'board') return '#5B4FDB';
  if (t === 'video') return '#0EC6C6';
  if (t === 'party') return '#FF6D3F';
  if (t === 'word') return '#22C55E';
  if (t === 'card') return '#E040FB';
  return '#5B4FDB';
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || 'My Top Games';
  const gamesRaw = searchParams.get('games');
  const themeKey = (searchParams.get('theme') || 'purple') as ThemeKey;
  const theme = THEMES[themeKey] || THEMES.purple;

  let games: CardGame[] = [];
  if (gamesRaw) {
    try {
      games = JSON.parse(decodeURIComponent(gamesRaw));
    } catch {
      // Ignore bad JSON
    }
  }

  // Clamp to 5 games
  games = games.slice(0, 5);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: theme.gradient,
          position: 'relative',
          overflow: 'hidden',
          padding: '48px 56px',
        }}
      >
        {/* Starfield dots for texture */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              borderRadius: '50%',
              background: `rgba(255,255,255,${0.1 + (i % 5) * 0.06})`,
              top: `${(i * 73 + 17) % 100}%`,
              left: `${(i * 47 + 31) % 100}%`,
            }}
          />
        ))}

        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.accent}20, transparent 70%)`,
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: '48px',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.1,
            marginBottom: '8px',
            display: 'flex',
          }}
        >
          {title}
        </div>

        {/* Accent underline */}
        <div
          style={{
            width: '120px',
            height: '4px',
            borderRadius: '2px',
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}66)`,
            marginBottom: '32px',
            display: 'flex',
          }}
        />

        {/* Game list */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
          }}
        >
          {games.map((game, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              {/* Rank number */}
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: theme.accent,
                  width: '40px',
                  textAlign: 'right',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                {i + 1}
              </div>

              {/* Type dot */}
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: typeColor(game.types),
                  flexShrink: 0,
                  display: 'flex',
                }}
              />

              {/* Game name */}
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  flex: 1,
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                {game.name.length > 40 ? game.name.slice(0, 38) + '...' : game.name}
              </div>

              {/* Score badge */}
              {game.score != null && game.score > 0 && (
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: game.score >= 0.7 ? '#22C55E' : game.score >= 0.4 ? '#FFB020' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {Math.round(game.score * 100)}% match
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: theme.accent,
                display: 'flex',
              }}
            >
              boredgame.lol
            </div>
            <div
              style={{
                fontSize: '16px',
                color: 'rgba(255,255,255,0.4)',
                display: 'flex',
              }}
            >
              Find your next favorite game
            </div>
          </div>

          <div
            style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.3)',
              display: 'flex',
            }}
          >
            Powered by AI
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
