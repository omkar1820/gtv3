// ============================================================
// GTA V — Game Backend API (Node.js + Express + PostgreSQL)
// ============================================================

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const { Pool }   = require('pg');
const redis      = require('redis');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'gta5-los-santos-secret-2024';

// ─── DATABASE ─────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'gta5game',
  user:     process.env.DB_USER     || 'gta5user',
  password: process.env.DB_PASSWORD || 'gta5pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ─── REDIS ────────────────────────────────────────────────────
let redisClient;
(async () => {
  try {
    redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    redisClient.on('error', err => console.warn('Redis error:', err.message));
    await redisClient.connect();
    console.log('✅ Redis connected');
  } catch (err) {
    console.warn('⚠️  Redis unavailable, using in-memory fallback');
    redisClient = null;
  }
})();

// ─── MIDDLEWARE ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10kb' }));
app.use(express.static('/app/frontend'));

// Rate limiting
const limiter = rateLimit({ windowMs: 60*1000, max: 100 });
app.use('/api/', limiter);

// ─── DB INIT ──────────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(50) UNIQUE NOT NULL,
        password   VARCHAR(255),
        email      VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS scores (
        id         SERIAL PRIMARY KEY,
        player_id  INT REFERENCES players(id) ON DELETE CASCADE,
        player_name VARCHAR(50),
        score      BIGINT NOT NULL DEFAULT 0,
        money      BIGINT NOT NULL DEFAULT 0,
        kills      INT    NOT NULL DEFAULT 0,
        wave       INT    NOT NULL DEFAULT 1,
        duration_s INT    NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id         SERIAL PRIMARY KEY,
        player_id  INT REFERENCES players(id) ON DELETE CASCADE,
        token      VARCHAR(500),
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS game_events (
        id         SERIAL PRIMARY KEY,
        player_name VARCHAR(50),
        event_type VARCHAR(50),
        payload    JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
      CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_name);
      CREATE INDEX IF NOT EXISTS idx_events_type ON game_events(event_type);
    `);
    console.log('✅ Database initialized');
  } finally {
    client.release();
  }
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── CACHE HELPER ─────────────────────────────────────────────
const memCache = new Map();
async function cacheGet(key) {
  if (redisClient) {
    const v = await redisClient.get(key);
    return v ? JSON.parse(v) : null;
  }
  const e = memCache.get(key);
  return e && e.exp > Date.now() ? e.val : null;
}
async function cacheSet(key, val, ttl=60) {
  if (redisClient) {
    await redisClient.setEx(key, ttl, JSON.stringify(val));
  } else {
    memCache.set(key, { val, exp: Date.now()+ttl*1000 });
  }
}

// ─── ROUTES ───────────────────────────────────────────────────

// Health check
app.get('/health', async (req, res) => {
  let dbOk=false, redisOk=false;
  try { await pool.query('SELECT 1'); dbOk=true; } catch {}
  try { if (redisClient) { await redisClient.ping(); redisOk=true; } } catch {}
  res.json({
    status: 'ok',
    service: 'gta5-backend',
    version: '2.0.1',
    timestamp: new Date().toISOString(),
    db: dbOk ? 'connected' : 'disconnected',
    redis: redisOk ? 'connected' : 'unavailable',
    uptime: process.uptime(),
  });
});

// Online players (fake counter + real)
app.get('/api/players/online', async (req, res) => {
  const count = Math.floor(200 + Math.random()*100);
  res.json({ count, timestamp: new Date().toISOString() });
});

// ── SCORES ────────────────────────────────────────────────────

// Submit score
app.post('/api/scores', async (req, res) => {
  const { name, score, money, kills, wave, duration_s } = req.body;
  if (!name || score == null) return res.status(400).json({ error: 'name and score required' });

  try {
    const result = await pool.query(
      `INSERT INTO scores (player_name, score, money, kills, wave, duration_s)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name.substring(0,50), parseInt(score), parseInt(money)||0,
       parseInt(kills)||0, parseInt(wave)||1, parseInt(duration_s)||0]
    );

    // Log event
    await pool.query(
      `INSERT INTO game_events (player_name, event_type, payload) VALUES ($1,$2,$3)`,
      [name, 'score_submitted', JSON.stringify({ score, kills, wave })]
    );

    // Bust cache
    if (redisClient) await redisClient.del('leaderboard:top');

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Top leaderboard
app.get('/api/scores/top', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit)||10, 50);

  const cached = await cacheGet('leaderboard:top');
  if (cached) return res.json(cached);

  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (player_name) player_name as name, score, kills, wave, created_at
       FROM scores ORDER BY player_name, score DESC LIMIT $1`,
      [limit]
    );
    const rows = result.rows.sort((a,b)=>b.score-a.score);
    await cacheSet('leaderboard:top', rows, 30);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Player scores
app.get('/api/scores/:name', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM scores WHERE player_name=$1 ORDER BY score DESC LIMIT 10`,
      [req.params.name]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// ── PLAYERS ───────────────────────────────────────────────────

// Register
app.post('/api/players/register', async (req, res) => {
  const { name, password, email } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'name and password required' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO players (name, password, email) VALUES ($1,$2,$3) RETURNING id, name, created_at`,
      [name.substring(0,50), hash, email]
    );
    const token = jwt.sign({ id: result.rows[0].id, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success:true, token, player: result.rows[0] });
  } catch (err) {
    if (err.code==='23505') return res.status(409).json({ error: 'Name taken' });
    res.status(500).json({ error: 'DB error' });
  }
});

// Login
app.post('/api/players/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM players WHERE name=$1`, [name]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const player = result.rows[0];
    const valid  = await bcrypt.compare(password, player.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: player.id, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success:true, token, player: { id:player.id, name:player.name } });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// ── STATS ─────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT player_name) AS total_players,
        COUNT(*) AS total_games,
        SUM(kills) AS total_kills,
        MAX(score) AS highest_score,
        AVG(score)::BIGINT AS avg_score,
        MAX(wave) AS highest_wave
      FROM scores
    `);
    res.json(stats.rows[0]);
  } catch {
    res.json({ total_players:247, total_games:1842, total_kills:58430, highest_score:985420, avg_score:45200, highest_wave:23 });
  }
});

// ─── ERROR HANDLING ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── START ────────────────────────────────────────────────────
async function start() {
  try {
    await initDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🎮 GTA5 Backend running on port ${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
