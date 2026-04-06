-- Outreach task tracker for SEO backlink campaigns
create table if not exists outreach_tasks (
  id serial primary key,
  -- Grouping / ordering
  category text not null,          -- e.g. 'ai-directories', 'reddit', 'bgg', 'product-directories', 'content', 'social', 'ongoing'
  priority int not null default 50, -- lower = higher priority (for sort order within category)
  day_target text,                  -- suggested day, e.g. 'Day 1', 'Day 5', 'Week 2'

  -- The task itself
  platform text not null,           -- e.g. 'There''s An AI For That', 'r/SideProject'
  url text not null,                -- submission URL
  post_title text,                  -- pre-written title (nullable, not all platforms need one)
  post_body text,                   -- pre-written body / description
  notes text,                       -- extra context, rules, tips

  -- Status tracking
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'wont_do', 'waiting')),
  result_notes text,                -- what happened after posting
  posted_url text,                  -- URL of the actual post once live

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast status filtering
create index idx_outreach_tasks_status on outreach_tasks (status);
create index idx_outreach_tasks_category on outreach_tasks (category, priority);

-- Auto-update updated_at
create or replace function update_outreach_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_outreach_updated_at
  before update on outreach_tasks
  for each row execute function update_outreach_updated_at();
