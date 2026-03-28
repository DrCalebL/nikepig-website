-- ============================================================
-- NIKEPIG Analytics — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Visitors (unique browser identities)
CREATE TABLE visitors (
  id TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  visit_count INTEGER NOT NULL DEFAULT 1
);

-- Sessions (one per browser tab lifecycle)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL REFERENCES visitors(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  -- Device info
  device_type TEXT,       -- desktop, mobile, tablet
  browser TEXT,
  os TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  language TEXT,
  touch_support BOOLEAN,
  pixel_ratio REAL,
  -- Geo (populated async after session start)
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  timezone TEXT,
  isp TEXT,
  -- Session end data (populated on page unload)
  duration INTEGER,              -- seconds
  max_scroll_depth INTEGER,      -- 0-100 percentage
  section_dwell_times JSONB,     -- { "hero": 12, "about": 8, ... }
  total_clicks INTEGER
);

-- Pageviews
CREATE TABLE pageviews (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  visitor_id TEXT NOT NULL REFERENCES visitors(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  path TEXT,
  referrer TEXT
);

-- Clicks (every tracked click event)
CREATE TABLE clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  tag TEXT,
  element_id TEXT,
  class_name TEXT,
  text TEXT,
  href TEXT,
  x INTEGER,
  y INTEGER,
  section TEXT
);

-- Indexes for dashboard queries
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_visitor_id ON sessions(visitor_id);
CREATE INDEX idx_clicks_session_id ON clicks(session_id);
CREATE INDEX idx_clicks_timestamp ON clicks(timestamp DESC);
CREATE INDEX idx_pageviews_timestamp ON pageviews(timestamp DESC);

-- ============================================================
-- Row Level Security (RLS)
-- The anon key can INSERT (tracker) and SELECT (dashboard).
-- No UPDATE/DELETE from anonymous users except session updates.
-- ============================================================

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pageviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE clicks ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracker sends data)
CREATE POLICY "Allow anon insert" ON visitors FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert" ON sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert" ON pageviews FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert" ON clicks FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous selects (dashboard reads data)
CREATE POLICY "Allow anon select" ON visitors FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select" ON sessions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select" ON pageviews FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select" ON clicks FOR SELECT TO anon USING (true);

-- Allow anonymous updates on visitors (visit count upsert) and sessions (end data + geo)
CREATE POLICY "Allow anon update" ON visitors FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon update" ON sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);
