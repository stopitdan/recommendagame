-- ============================================================================
-- Migration 006: LLM Parse Cache
-- ============================================================================
-- Caches LLM-parsed free text preferences to avoid duplicate API calls.
-- Supports exact match on normalized_input and application-side fuzzy matching.

create table if not exists public.llm_parse_cache (
  id bigint primary key generated always as identity,
  raw_input text not null,
  normalized_input text not null,
  parsed_result jsonb not null,
  model text not null default 'gpt-4o-mini',
  created_at timestamptz not null default now(),

  unique (normalized_input)
);

create index if not exists idx_llm_cache_normalized
  on public.llm_parse_cache (normalized_input);

create index if not exists idx_llm_cache_recent
  on public.llm_parse_cache (created_at desc);

-- Public read/write since this is non-sensitive cache data
alter table public.llm_parse_cache enable row level security;
create policy "LLM cache is publicly readable"
  on public.llm_parse_cache for select using (true);
create policy "LLM cache is server-writable"
  on public.llm_parse_cache for insert with check (true);
create policy "LLM cache is server-updatable"
  on public.llm_parse_cache for update using (true);
