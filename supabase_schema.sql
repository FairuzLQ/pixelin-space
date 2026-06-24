-- Run this in Supabase SQL Editor

-- Posts
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  content text,
  image_url text,
  nickname text not null,
  ip_hash text,
  fingerprint text,
  reaction_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Reactions
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  type text not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique(post_id, type, fingerprint)
);

-- Comments
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  content text not null,
  nickname text not null,
  ip_hash text,
  fingerprint text,
  created_at timestamptz not null default now()
);

-- DM conversations
create table if not exists dm_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- DM participants (max 3 enforced in app)
create table if not exists dm_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  nickname text not null,
  fingerprint text not null,
  joined_at timestamptz not null default now()
);

-- DM messages
create table if not exists dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  sender_nickname text not null,
  sender_fingerprint text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists posts_created_at_idx on posts(created_at desc);
create index if not exists reactions_post_id_idx on reactions(post_id);
create index if not exists comments_post_id_idx on comments(post_id);
create index if not exists dm_participants_conversation_id_idx on dm_participants(conversation_id);
create index if not exists dm_participants_fingerprint_idx on dm_participants(fingerprint);
create index if not exists dm_messages_conversation_id_idx on dm_messages(conversation_id);

-- RPC helper functions for atomic counters
create or replace function increment_reactions(pid uuid)
returns void language sql as $$
  update posts set reaction_count = reaction_count + 1 where id = pid;
$$;

create or replace function decrement_reactions(pid uuid)
returns void language sql as $$
  update posts set reaction_count = greatest(0, reaction_count - 1) where id = pid;
$$;

create or replace function increment_comments(pid uuid)
returns void language sql as $$
  update posts set comment_count = comment_count + 1 where id = pid;
$$;

-- RLS: allow public read/write (anon key is used)
alter table posts enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;
alter table dm_conversations enable row level security;
alter table dm_participants enable row level security;
alter table dm_messages enable row level security;

create policy "public read posts" on posts for select using (true);
create policy "public insert posts" on posts for insert with check (true);

create policy "public read reactions" on reactions for select using (true);
create policy "public insert reactions" on reactions for insert with check (true);
create policy "public delete reactions" on reactions for delete using (true);

create policy "public read comments" on comments for select using (true);
create policy "public insert comments" on comments for insert with check (true);

create policy "public read dm_conversations" on dm_conversations for select using (true);
create policy "public insert dm_conversations" on dm_conversations for insert with check (true);
create policy "public update dm_conversations" on dm_conversations for update using (true);

create policy "public read dm_participants" on dm_participants for select using (true);
create policy "public insert dm_participants" on dm_participants for insert with check (true);
create policy "public update dm_participants" on dm_participants for update using (true);

create policy "public read dm_messages" on dm_messages for select using (true);
create policy "public insert dm_messages" on dm_messages for insert with check (true);

-- Storage bucket for post images (run manually in dashboard or via this SQL)
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict do nothing;

create policy "public upload post-images" on storage.objects for insert
  with check (bucket_id = 'post-images');
create policy "public read post-images" on storage.objects for select
  using (bucket_id = 'post-images');
