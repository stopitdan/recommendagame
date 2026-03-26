/**
 * Bust the LLM parse cache (both Supabase and in-memory).
 * Run: npx tsx scripts/bust-llm-cache.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error, count } = await supabase
    .from('llm_parse_cache')
    .delete()
    .gt('id', 0);

  if (error) {
    console.error('Failed:', error.message);
  } else {
    console.log(`LLM cache busted. Restart dev server to clear in-memory cache too.`);
  }
}

main();
