-- ============================================================
-- GTA V Game Database — PostgreSQL Init Script
-- ============================================================

-- Create database (run as superuser)
-- CREATE DATABASE gta5game;
-- CREATE USER gta5user WITH PASSWORD 'gta5pass';
-- GRANT ALL PRIVILEGES ON DATABASE gta5game TO gta5user;

-- ─── TABLES ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) UNIQUE NOT NULL,
  password   VARCHAR(255),
  email      VARCHAR(100),
  avatar_url VARCHAR(500),
  is_banned  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
  id          SERIAL PRIMARY KEY,
  player_id   INT REFERENCES players(id) ON DELETE CASCADE,
  player_name VARCHAR(50) NOT NULL,
  score       BIGINT NOT NULL DEFAULT 0,
  money       BIGINT NOT NULL DEFAULT 0,
  kills       INT    NOT NULL DEFAULT 0,
  wave        INT    NOT NULL DEFAULT 1,
  duration_s  INT    NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  player_id  INT REFERENCES players(id) ON DELETE CASCADE,
  token      VARCHAR(600) UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_events (
  id          SERIAL PRIMARY KEY,
  player_name VARCHAR(50),
  event_type  VARCHAR(50) NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  reward      BIGINT DEFAULT 0,
  difficulty  VARCHAR(20) DEFAULT 'normal'
);

-- ─── INDEXES ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_scores_score       ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_player_name ON scores(player_name);
CREATE INDEX IF NOT EXISTS idx_scores_created     ON scores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type        ON game_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_player      ON game_events(player_name);
CREATE INDEX IF NOT EXISTS idx_events_created     ON game_events(created_at DESC);

-- ─── SEED DATA ────────────────────────────────────────────────

INSERT INTO missions (name, description, reward, difficulty) VALUES
  ('Tutorial',      'Learn the basics of Los Santos.',                  500,   'easy'),
  ('Street Hustle', 'Eliminate 10 enemy gang members.',                 2000,  'easy'),
  ('Bank Job',      'Collect $50,000 in pickups across the city.',      5000,  'medium'),
  ('Police Chase',  'Survive a 5-star wanted level for 60 seconds.',    10000, 'hard'),
  ('The Big Heist', 'Take down 25 enemies and escape with the money.',  25000, 'hard')
ON CONFLICT DO NOTHING;

-- Demo leaderboard entries
INSERT INTO scores (player_name, score, money, kills, wave) VALUES
  ('Trevor Phillips',  985420, 2500000, 482, 18),
  ('Michael De Santa', 742000, 1800000, 341, 14),
  ('Franklin Clinton', 531800, 1200000, 268, 11),
  ('Lamar Davis',      320500,  850000, 185,  8),
  ('Los Santos Pro',   210000,  620000, 142,  7)
ON CONFLICT DO NOTHING;
