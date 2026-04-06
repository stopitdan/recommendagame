import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { GameRow } from '@/types/supabase';
import { rowToGame } from '@/lib/supabase/games';
import GameDetailView from './GameDetailView';

/** Metadata-only columns — skip heavy fields to keep metadata resolution fast. */
const METADATA_COLUMNS = 'id,name,description,types,rating,rating_count,min_players,max_players,categories,year_published,thumbnail_url,image_url';

function createDbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function fetchGameForMetadata(id: string) {
  const supabase = createDbClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('games')
    .select(METADATA_COLUMNS)
    .eq('id', id)
    .single();

  if (!data) return null;
  return rowToGame(data as GameRow);
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await fetchGameForMetadata(id);

  if (!game) {
    return { title: 'Game Not Found' };
  }

  const playerRange = game.playerCount
    ? game.playerCount.min === game.playerCount.max
      ? `${game.playerCount.min} players`
      : `${game.playerCount.min}-${game.playerCount.max} players`
    : null;
  const ratingText = game.rating ? `${game.rating.toFixed(1)}/10` : null;
  const typeLabel = game.types?.length
    ? game.types.map((t) => t.charAt(0).toUpperCase() + t.slice(1) + ' Game').join(', ')
    : 'Game';

  const descParts = [typeLabel];
  if (ratingText) descParts.push(`rated ${ratingText}`);
  if (playerRange) descParts.push(playerRange);
  if (game.yearPublished) descParts.push(`(${game.yearPublished})`);
  const shortDesc = descParts.join(' · ');

  const fullDescription = game.description
    ? `${shortDesc}. ${game.description.slice(0, 160).replace(/\s+\S*$/, '')}...`
    : shortDesc;

  const categories = game.categories?.slice(0, 5) ?? [];

  return {
    title: game.name,
    description: fullDescription,
    keywords: [game.name, ...categories, typeLabel, 'game recommendation', 'boredgame.lol'],
    openGraph: {
      title: `${game.name} | boredgame.lol`,
      description: fullDescription,
      type: 'website',
      url: `https://boredgame.lol/games/${game.id}`,
      siteName: 'boredgame.lol',
      ...(game.imageUrl && {
        images: [{ url: game.imageUrl, alt: game.name }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${game.name} | boredgame.lol`,
      description: shortDesc,
      ...(game.imageUrl && { images: [game.imageUrl] }),
    },
    alternates: {
      canonical: `https://boredgame.lol/games/${game.id}`,
    },
  };
}

export default function GameDetailPage() {
  return <GameDetailView />;
}
