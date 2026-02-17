-- Flowin Supabase Migration: Create all tables with Row Level Security
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 1. sites — the anchor for multi-tenancy
-- =========================================================================
create table if not exists sites (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users,
  site_slug text unique not null,
  title text,
  purpose text,
  features text[],
  color_scheme text default 'calm',
  created_at timestamptz default now()
);

alter table sites enable row level security;

create policy "owners_manage_sites" on sites
  for all using (auth.uid() = owner_id);

-- Allow service role (backend) to insert sites for new users
create policy "service_insert_sites" on sites
  for insert with check (true);

-- =========================================================================
-- 2. events — calendar items, schedules, recurring plans
-- =========================================================================
create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references sites(id) on delete cascade not null,
  title text,
  details text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_all_day boolean default false,
  location text,
  created_by uuid references auth.users
);

alter table events enable row level security;

create policy "site_owners_manage_events" on events
  for all using (
    site_id in (select id from sites where owner_id = auth.uid())
  );

-- Allow public reads for published site pages
create policy "public_read_events" on events
  for select using (true);

-- =========================================================================
-- 3. submissions — form responses from visitors
-- =========================================================================
create table if not exists submissions (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references sites(id) on delete cascade not null,
  form_slug text,
  payload jsonb,
  submitted_at timestamptz default now()
);

alter table submissions enable row level security;

-- Site owners can read all submissions for their site
create policy "owners_read_submissions" on submissions
  for select using (
    site_id in (select id from sites where owner_id = auth.uid())
  );

-- Allow anonymous inserts so public forms can post data
create policy "anon_insert_submissions" on submissions
  for insert with check (true);

-- =========================================================================
-- 4. members — collaborators allowed to edit
-- =========================================================================
create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references sites(id) on delete cascade not null,
  user_id uuid references auth.users,
  email text,
  role text default 'editor',
  invited_at timestamptz default now()
);

alter table members enable row level security;

create policy "owners_manage_members" on members
  for all using (
    site_id in (select id from sites where owner_id = auth.uid())
  );

create policy "members_read_own" on members
  for select using (auth.uid() = user_id);

-- =========================================================================
-- 5. projects — portfolio pieces, resume highlights, case studies
-- =========================================================================
create table if not exists projects (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references sites(id) on delete cascade not null,
  title text,
  summary text,
  tags text[],
  order_index int default 0,
  featured boolean default false
);

alter table projects enable row level security;

create policy "site_owners_manage_projects" on projects
  for all using (
    site_id in (select id from sites where owner_id = auth.uid())
  );

create policy "public_read_projects" on projects
  for select using (true);

-- =========================================================================
-- 6. offerings — services or products for a business page
-- =========================================================================
create table if not exists offerings (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references sites(id) on delete cascade not null,
  title text,
  price text,
  description text,
  image_url text
);

alter table offerings enable row level security;

create policy "site_owners_manage_offerings" on offerings
  for all using (
    site_id in (select id from sites where owner_id = auth.uid())
  );

create policy "public_read_offerings" on offerings
  for select using (true);

-- =========================================================================
-- 7. rsvps — guest attendance records
-- =========================================================================
create table if not exists rsvps (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid references sites(id) on delete cascade not null,
  guest_name text,
  contact text,
  party_size int,
  notes text,
  status text default 'pending',
  submitted_at timestamptz default now()
);

alter table rsvps enable row level security;

-- Allow anonymous inserts (public RSVP forms)
create policy "anon_insert_rsvps" on rsvps
  for insert with check (true);

-- Limit reads to site owners and members
create policy "owners_read_rsvps" on rsvps
  for select using (
    site_id in (select id from sites where owner_id = auth.uid())
  );
