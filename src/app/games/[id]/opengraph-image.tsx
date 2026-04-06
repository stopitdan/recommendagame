import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame } from '@/lib/supabase/games';

export const alt = 'Game details on boredgame.lol';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createDbClient();
  let gameName = 'Game';
  let rating = '';
  let playerRange = '';
  let typeLabel = '';
  let categories: string[] = [];
  let yearText = '';

  if (supabase) {
    const { data } = await supabase
      .from('games')
      .select('id,name,types,rating,min_players,max_players,categories,year_published')
      .eq('id', id)
      .single();

    if (data) {
      const game = rowToGame(data as GameRow);
      gameName = game.name;
      rating = game.rating ? `${game.rating.toFixed(1)}/10` : '';
      typeLabel = game.types?.length
        ? game.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' / ')
        : '';
      categories = game.categories?.slice(0, 3) ?? [];
      yearText = game.yearPublished ? String(game.yearPublished) : '';
      if (game.playerCount) {
        playerRange = game.playerCount.min === game.playerCount.max
          ? `${game.playerCount.min}P`
          : `${game.playerCount.min}-${game.playerCount.max}P`;
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(145deg, #0a0a1a 0%, #12102e 40%, #0d1520 100%)',
          position: 'relative',
          overflow: 'hidden',
          padding: '60px 80px',
        }}
      >
        {/* Starfield dots */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              borderRadius: '50%',
              background: `rgba(255,255,255,${0.12 + (i % 5) * 0.06})`,
              top: `${(i * 73 + 17) % 100}%`,
              left: `${(i * 47 + 31) % 100}%`,
            }}
          />
        ))}

        {/* Type + Year badge */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            fontSize: '18px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#FF6D3F',
          }}
        >
          {typeLabel && <span>{typeLabel}</span>}
          {typeLabel && yearText && <span style={{ color: 'rgba(255,255,255,0.3)' }}>&middot;</span>}
          {yearText && <span>{yearText}</span>}
        </div>

        {/* Game name */}
        <div
          style={{
            fontSize: gameName.length > 40 ? '48px' : gameName.length > 25 ? '56px' : '64px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.15,
            maxWidth: '1000px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            marginBottom: '24px',
          }}
        >
          {gameName}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '32px',
            fontSize: '24px',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '20px',
          }}
        >
          {rating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#0EC6C6', fontWeight: 700 }}>{rating}</span>
            </div>
          )}
          {playerRange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{playerRange}</span>
            </div>
          )}
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <div
                key={cat}
                style={{
                  padding: '6px 16px',
                  borderRadius: '20px',
                  background: 'rgba(91, 79, 219, 0.25)',
                  border: '1px solid rgba(91, 79, 219, 0.4)',
                  color: '#a89ef5',
                  fontSize: '16px',
                  fontWeight: 500,
                }}
              >
                {cat}
              </div>
            ))}
          </div>
        )}

        {/* Accent underline */}
        <div
          style={{
            position: 'absolute',
            bottom: '80px',
            left: '80px',
            width: '120px',
            height: '4px',
            borderRadius: '2px',
            background: 'linear-gradient(90deg, #0EC6C6, #5B4FDB)',
          }}
        />

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            left: '80px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '18px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          boredgame.lol
        </div>
      </div>
    ),
    { ...size },
  );
}
