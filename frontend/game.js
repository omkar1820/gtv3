// ============================================================
// GTA V — Los Santos Online | Full Game Engine
// ============================================================

const API_BASE = window.API_BASE || 'http://localhost:3000/api';

// ─── STATE ───────────────────────────────────────────────────
const State = {
  player: {
    x: 400, y: 300,
    vx: 0, vy: 0,
    speed: 3.5, runSpeed: 6,
    health: 100, maxHealth: 100,
    armor: 75, maxArmor: 75,
    money: 50000,
    score: 0,
    kills: 0,
    angle: 0,
    inCar: false,
    car: null,
    currentWeapon: 0,
    weapons: [
      { name: 'PISTOL',    icon: '🔫', clip: 15, total: 90,  damage: 25, fireRate: 300, color: '#ffff00' },
      { name: 'SMG',       icon: '🔩', clip: 30, total: 180, damage: 15, fireRate: 100, color: '#00ffff' },
      { name: 'SHOTGUN',   icon: '💥', clip: 8,  total: 40,  damage: 60, fireRate: 800, color: '#ff6600' },
    ],
    lastShot: 0,
    reloading: false,
    invincible: false,
    invincibleTimer: 0,
    wantedLevel: 0,
    wantedTimer: 0,
    name: localStorage.getItem('gta_player_name') || 'Player',
  },
  enemies: [],
  bullets: [],
  cars: [],
  pickups: [],
  particles: [],
  explosions: [],
  buildings: [],
  roads: [],
  missionProgress: 0,
  missionTarget: 100,
  currentMission: 0,
  gameRunning: false,
  paused: false,
  camera: { x: 0, y: 0 },
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  gameTime: 0,
  gameSeconds: 0,
  waveNumber: 1,
  enemiesKilled: 0,
  spawnTimer: 0,
  spawnInterval: 180,
  policeSpawnTimer: 0,
  score: 0,
};

// ─── CANVAS ──────────────────────────────────────────────────
let canvas, ctx, minimapCtx, bgCanvas, bgCtx;
let lastTime = 0, gameLoop = null;

// ─── MISSIONS ────────────────────────────────────────────────
const MISSIONS = [
  { name: 'Tutorial',       obj: 'Move with WASD. Click to shoot enemies.',         target: 5  },
  { name: 'Street Hustle',  obj: 'Eliminate 10 enemy gang members.',                target: 10 },
  { name: 'Bank Job',       obj: 'Collect $50,000 in pickups.',                     target: 20 },
  { name: 'Police Chase',   obj: 'Survive 5-star wanted level for 60 seconds.',     target: 30 },
  { name: 'Heist',          obj: 'Eliminate 25 enemies and escape.',                target: 50 },
];

// ─── LOADING ─────────────────────────────────────────────────
window.addEventListener('load', () => {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  const mc = document.getElementById('minimapCanvas');
  minimapCtx = mc.getContext('2d');
  bgCanvas = document.getElementById('bgCanvas');
  bgCtx = bgCanvas?.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  bootLoadingScreen();
});

function resizeCanvas() {
  [canvas, bgCanvas].forEach(c => {
    if (!c) return;
    c.width  = window.innerWidth;
    c.height = window.innerHeight;
  });
}

async function bootLoadingScreen() {
  const bar  = document.getElementById('loadBar');
  const text = document.getElementById('loadText');
  const steps = [
    [10, 'Loading world geometry...'],
    [25, 'Spawning Los Santos civilians...'],
    [40, 'Generating road networks...'],
    [55, 'Loading weapon assets...'],
    [70, 'Connecting to game server...'],
    [85, 'Initializing police AI...'],
    [95, 'Fetching leaderboard...'],
    [100,'Welcome to Los Santos.'],
  ];
  for (const [pct, msg] of steps) {
    bar.style.width = pct + '%';
    text.textContent = msg;
    await sleep(300 + Math.random() * 200);
  }
  await sleep(600);
  document.getElementById('loadingScreen').style.display = 'none';
  showMainMenu();
}

// ─── MENU ─────────────────────────────────────────────────────
function showMainMenu() {
  document.getElementById('mainMenu').classList.remove('hidden');
  if (bgCanvas) drawMenuBackground();
  fetchOnlinePlayers();
}

function drawMenuBackground() {
  bgCtx.clearRect(0,0,bgCanvas.width,bgCanvas.height);
  // Night city gradient
  const grad = bgCtx.createLinearGradient(0,0,0,bgCanvas.height);
  grad.addColorStop(0,'#050510');
  grad.addColorStop(0.6,'#0a0a1a');
  grad.addColorStop(1,'#000000');
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0,0,bgCanvas.width,bgCanvas.height);

  // Stars
  bgCtx.fillStyle = 'rgba(255,255,255,0.6)';
  for (let i=0; i<200; i++) {
    const sx = (i*137.5)%bgCanvas.width;
    const sy = (i*97.3) %( bgCanvas.height*0.5);
    const r  = Math.random() < 0.1 ? 1.5 : 0.8;
    bgCtx.beginPath();
    bgCtx.arc(sx,sy,r,0,Math.PI*2);
    bgCtx.fill();
  }

  // Building silhouettes
  drawMenuBuildings();
}

function drawMenuBuildings() {
  const W = bgCanvas.width, H = bgCanvas.height;
  const buildings = [];
  let x=0;
  while (x < W) {
    const w = 40 + Math.floor(x*0.03)%60;
    const h = 80 + Math.floor(x*0.07)%220;
    buildings.push({x,w,h});
    x += w + 4;
  }
  // far layer
  bgCtx.fillStyle = '#111118';
  buildings.forEach(b => {
    bgCtx.fillRect(b.x+20, H-b.h*0.6, b.w-5, b.h*0.6);
  });
  // near layer
  bgCtx.fillStyle = '#0a0a12';
  buildings.forEach(b => {
    bgCtx.fillRect(b.x, H-b.h, b.w, b.h);
    // windows
    for (let wy=H-b.h+10; wy<H-20; wy+=16) {
      for (let wx=b.x+5; wx<b.x+b.w-8; wx+=12) {
        if (Math.random()>0.5) {
          bgCtx.fillStyle = Math.random()>0.8 ?
            'rgba(255,200,50,0.6)' : 'rgba(100,150,255,0.3)';
          bgCtx.fillRect(wx,wy,6,8);
        }
      }
    }
    bgCtx.fillStyle = '#0a0a12';
  });
}

async function fetchOnlinePlayers() {
  try {
    const r = await fetch(`${API_BASE}/players/online`);
    if (r.ok) {
      const d = await r.json();
      document.getElementById('onlinePlayers').textContent = `${d.count} Online`;
    }
  } catch { /* server might not be running */ }
}

// ─── GAME INIT ────────────────────────────────────────────────
function startGame() {
  document.getElementById('mainMenu').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('pauseMenu').classList.add('hidden');

  initGame();
  bindInput();
  if (gameLoop) cancelAnimationFrame(gameLoop);
  State.gameRunning = true;
  lastTime = performance.now();
  gameLoop = requestAnimationFrame(gameStep);
}

function initGame() {
  const W = canvas.width, H = canvas.height;
  const WORLD = { w: 2400, h: 2400 };

  Object.assign(State, {
    player: {
      ...State.player,
      x: WORLD.w/2, y: WORLD.h/2,
      vx: 0, vy: 0,
      health: 100, armor: 75,
      money: 50000, score: 0, kills: 0,
      inCar: false, car: null,
      currentWeapon: 0, lastShot: 0, reloading: false,
      invincible: false, invincibleTimer: 0,
      wantedLevel: 0, wantedTimer: 0,
      weapons: [
        { name:'PISTOL', icon:'🔫', clip:15, total:90,  damage:25, fireRate:300, color:'#ffff00' },
        { name:'SMG',    icon:'🔩', clip:30, total:180, damage:15, fireRate:100, color:'#00ffff' },
        { name:'SHOTGUN',icon:'💥', clip:8,  total:40,  damage:60, fireRate:800, color:'#ff6600' },
      ],
    },
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    explosions: [],
    score: 0,
    gameTime: 0,
    gameSeconds: 0,
    waveNumber: 1,
    enemiesKilled: 0,
    spawnTimer: 0,
    spawnInterval: 180,
    missionProgress: 0,
    currentMission: 0,
    camera: { x: WORLD.w/2 - W/2, y: WORLD.h/2 - H/2 },
  });

  State.WORLD = WORLD;
  State.cars   = generateCars(WORLD);
  State.buildings = generateBuildings(WORLD);
  State.roads  = generateRoads(WORLD);
  spawnInitialPickups();

  updateHUD();
  setMission(0);
  showNotif('Welcome to Los Santos', 'success');
  showNotif(`Mission: ${MISSIONS[0].name}`, '');
}

// ─── WORLD GENERATION ─────────────────────────────────────────
function generateBuildings(W) {
  const buildings = [];
  const colors = ['#1a1a2e','#16213e','#0f3460','#1a2a1a','#2a1a1a','#1a1a1a'];
  for (let i=0; i<120; i++) {
    const bw = 60 + Math.random()*120;
    const bh = 60 + Math.random()*120;
    buildings.push({
      x: Math.random()*(W.w-bw),
      y: Math.random()*(W.h-bh),
      w: bw, h: bh,
      color: colors[Math.floor(Math.random()*colors.length)],
      height3d: 20 + Math.random()*80,
    });
  }
  return buildings;
}

function generateRoads(W) {
  const roads = [];
  // Horizontal roads
  for (let y=200; y<W.h; y+=300) {
    roads.push({ x1:0, y1:y, x2:W.w, y2:y, w:40, horiz:true });
  }
  // Vertical roads
  for (let x=200; x<W.w; x+=300) {
    roads.push({ x1:x, y1:0, x2:x, y2:W.h, w:40, vert:true });
  }
  return roads;
}

function generateCars(W) {
  const types = [
    { name:'Sultan RS', icon:'🚗', color:'#e53935', speed:5, hp:200 },
    { name:'Infernus',  icon:'🏎️', color:'#f5c518', speed:7, hp:150 },
    { name:'Mesa',      icon:'🚙', color:'#43a047', speed:4, hp:300 },
    { name:'NRG-500',   icon:'🏍️', color:'#00b0ff', speed:8, hp:100 },
    { name:'Rhino',     icon:'🚛', color:'#607d8b', speed:3, hp:500 },
  ];
  return Array.from({length:20}, (_,i) => {
    const t = types[i % types.length];
    return {
      ...t,
      x: 200 + Math.random()*(W.w-400),
      y: 200 + Math.random()*(W.h-400),
      angle: Math.random()*Math.PI*2,
      w: 36, h: 20,
      currentHp: t.hp,
      occupied: false,
    };
  });
}

function spawnInitialPickups() {
  const W = State.WORLD;
  for (let i=0; i<30; i++) {
    State.pickups.push(randomPickup(
      100 + Math.random()*(W.w-200),
      100 + Math.random()*(W.h-200)
    ));
  }
}

function randomPickup(x,y) {
  const types = [
    { type:'health', icon:'❤️', color:'#76ff03', value:30, label:'+30 HP' },
    { type:'armor',  icon:'🛡️', color:'#00b0ff', value:50, label:'+50 Armor' },
    { type:'money',  icon:'💰', color:'#f5c518', value:500+Math.floor(Math.random()*2000), label:'+$' },
    { type:'ammo',   icon:'🔸', color:'#ff6b00', value:30, label:'+Ammo' },
    { type:'weapon', icon:'🔫', color:'#ff1744', value:1,  label:'Weapon' },
    { type:'star',   icon:'⭐', color:'#fff176', value:100, label:'+100 Score' },
  ];
  const t = types[Math.floor(Math.random()*types.length)];
  return { ...t, x, y, r:14, pulse:0 };
}

// ─── INPUT ────────────────────────────────────────────────────
function bindInput() {
  document.onkeydown = e => {
    State.keys[e.code] = true;
    if (e.code==='Escape') { State.paused ? resumeGame() : pauseGame(); }
    if (e.code==='KeyR') reloadWeapon();
    if (e.code==='KeyE') tryEnterCar();
    if (e.code==='Digit1') switchWeapon(0);
    if (e.code==='Digit2') switchWeapon(1);
    if (e.code==='Digit3') switchWeapon(2);
  };
  document.onkeyup = e => { State.keys[e.code] = false; };

  canvas.onmousemove = e => {
    const rect = canvas.getBoundingClientRect();
    State.mouse.x = e.clientX - rect.left;
    State.mouse.y = e.clientY - rect.top;
  };
  canvas.onmousedown = e => {
    State.mouse.down = true;
    if (!State.paused && State.gameRunning) tryShoot();
  };
  canvas.onmouseup = () => { State.mouse.down = false; };
}

// ─── GAME LOOP ────────────────────────────────────────────────
function gameStep(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 16.67, 3);
  lastTime = timestamp;

  if (!State.paused && State.gameRunning) {
    update(dt);
    render();
  }
  gameLoop = requestAnimationFrame(gameStep);
}

// ─── UPDATE ───────────────────────────────────────────────────
function update(dt) {
  State.gameTime += dt;
  if (State.gameTime % 60 < dt) {
    State.gameSeconds++;
    updateClock();
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateExplosions(dt);
  updateCamera();
  updateSpawning(dt);
  updateWanted(dt);

  if (State.mouse.down) tryShoot();

  // Auto-add pickups
  if (State.pickups.length < 15) {
    const W = State.WORLD;
    State.pickups.push(randomPickup(
      100+Math.random()*(W.w-200),
      100+Math.random()*(W.h-200)
    ));
  }
}

function updatePlayer(dt) {
  const p = State.player;
  const speed = State.keys['ShiftLeft'] || State.keys['ShiftRight']
    ? p.runSpeed : p.speed;

  let mx=0, my=0;
  if (State.keys['KeyW']||State.keys['ArrowUp'])    my=-1;
  if (State.keys['KeyS']||State.keys['ArrowDown'])  my= 1;
  if (State.keys['KeyA']||State.keys['ArrowLeft'])  mx=-1;
  if (State.keys['KeyD']||State.keys['ArrowRight']) mx= 1;

  if (mx||my) {
    const len = Math.sqrt(mx*mx+my*my);
    p.vx = (mx/len)*speed*dt;
    p.vy = (my/len)*speed*dt;
  } else {
    p.vx *= 0.8;
    p.vy *= 0.8;
  }

  // Collision with buildings
  let nx = p.x + p.vx;
  let ny = p.y + p.vy;

  for (const b of State.buildings) {
    if (nx+12>b.x && nx-12<b.x+b.w && ny+12>b.y && ny-12<b.y+b.h) {
      if (!(p.x+12>b.x && p.x-12<b.x+b.w)) p.vx = 0;
      if (!(p.y+12>b.y && p.y-12<b.y+b.h)) p.vy = 0;
      nx = p.x + p.vx;
      ny = p.y + p.vy;
    }
  }

  // World bounds
  p.x = Math.max(20, Math.min(State.WORLD.w-20, nx));
  p.y = Math.max(20, Math.min(State.WORLD.h-20, ny));

  // Aim angle
  const wx = p.x - State.camera.x;
  const wy = p.y - State.camera.y;
  p.angle = Math.atan2(State.mouse.y - wy, State.mouse.x - wx);

  // Invincibility timer
  if (p.invincible) {
    p.invincibleTimer -= dt;
    if (p.invincibleTimer <= 0) p.invincible = false;
  }

  // Check pickups
  for (let i=State.pickups.length-1; i>=0; i--) {
    const pk = State.pickups[i];
    const dx = p.x - pk.x, dy = p.y - pk.y;
    if (dx*dx+dy*dy < (pk.r+16)*(pk.r+16)) {
      collectPickup(pk, i);
    }
  }
}

function collectPickup(pk, idx) {
  const p = State.player;
  State.pickups.splice(idx, 1);
  spawnParticles(pk.x, pk.y, pk.color, 8);

  switch(pk.type) {
    case 'health':
      p.health = Math.min(p.maxHealth, p.health + pk.value);
      showNotif(`❤️ +${pk.value} Health`, 'success');
      break;
    case 'armor':
      p.armor = Math.min(p.maxArmor, p.armor + pk.value);
      showNotif(`🛡️ +${pk.value} Armor`, 'success');
      break;
    case 'money':
      p.money += pk.value;
      p.score += Math.floor(pk.value/10);
      State.score += Math.floor(pk.value/10);
      showNotif(`💰 +$${pk.value.toLocaleString()}`, 'success');
      checkMissionProgress('money', pk.value);
      break;
    case 'ammo':
      p.weapons.forEach(w => w.total += 30);
      showNotif('🔸 +Ammo Collected', '');
      break;
    case 'weapon':
      showNotif(`🔫 New Weapon!`, 'success');
      break;
    case 'star':
      p.score += pk.value;
      State.score += pk.value;
      showNotif(`⭐ +${pk.value} Score!`, 'success');
      break;
  }
  updateHUD();
}

function updateEnemies(dt) {
  const p = State.player;
  for (let i=State.enemies.length-1; i>=0; i--) {
    const e = State.enemies[i];

    const dx = p.x - e.x, dy = p.y - e.y;
    const dist = Math.sqrt(dx*dx+dy*dy);

    if (dist < 2000) {
      e.angle = Math.atan2(dy, dx);
      if (dist > 50) {
        e.x += Math.cos(e.angle)*e.speed*dt;
        e.y += Math.sin(e.angle)*e.speed*dt;
      }

      // Enemy shoots
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 400) {
        e.shootTimer = e.fireRate;
        State.bullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(e.angle)*8,
          vy: Math.sin(e.angle)*8,
          owner: 'enemy',
          damage: e.damage,
          color: '#ff4444', r: 4,
          life: 80,
        });
      }

      // Melee
      if (dist < 30 && !p.invincible) {
        if (!e.meleeTimer || e.meleeTimer <= 0) {
          damagePlayer(e.damage * 0.5);
          e.meleeTimer = 60;
          spawnParticles(p.x, p.y, '#ff0000', 5);
        }
      }
      if (e.meleeTimer) e.meleeTimer -= dt;
    }

    if (e.hp <= 0) {
      spawnParticles(e.x, e.y, '#ff4444', 12);
      spawnPickupOnKill(e.x, e.y);
      State.enemies.splice(i, 1);
      p.kills++;
      State.enemiesKilled++;
      State.score += 150 * State.waveNumber;
      p.score    += 150 * State.waveNumber;
      p.money    += 200 * State.waveNumber;
      p.wantedLevel = Math.min(5, p.wantedLevel + 0.5);
      p.wantedTimer = 600;
      checkMissionProgress('kill', 1);
      updateHUD();
    }
  }
}

function spawnPickupOnKill(x, y) {
  if (Math.random() < 0.4) {
    State.pickups.push(randomPickup(x, y));
  }
}

function updateBullets(dt) {
  const p = State.player;
  for (let i=State.bullets.length-1; i>=0; i--) {
    const b = State.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    if (b.life <= 0) { State.bullets.splice(i,1); continue; }

    // Building collision
    let hit = false;
    for (const bl of State.buildings) {
      if (b.x>bl.x && b.x<bl.x+bl.w && b.y>bl.y && b.y<bl.y+bl.h) {
        spawnParticles(b.x, b.y, '#aaa', 3);
        State.bullets.splice(i,1);
        hit = true; break;
      }
    }
    if (hit) continue;

    // Enemy hit
    if (b.owner === 'player') {
      for (const e of State.enemies) {
        const dx=b.x-e.x, dy=b.y-e.y;
        if (dx*dx+dy*dy < (e.r+4)*(e.r+4)) {
          e.hp -= b.damage;
          spawnParticles(b.x, b.y, '#ff8800', 5);
          State.bullets.splice(i,1);
          hit=true; break;
        }
      }
    }
    if (hit) continue;

    // Player hit
    if (b.owner==='enemy' && !p.invincible) {
      const dx=b.x-p.x, dy=b.y-p.y;
      if (dx*dx+dy*dy < 20*20) {
        damagePlayer(b.damage);
        spawnParticles(b.x, b.y, '#ff0000', 6);
        State.bullets.splice(i,1);
      }
    }
  }
}

function updatePickups(dt) {
  for (const pk of State.pickups) {
    pk.pulse = (pk.pulse + 0.05*dt) % (Math.PI*2);
  }
}

function updateParticles(dt) {
  for (let i=State.particles.length-1; i>=0; i--) {
    const p = State.particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vy += 0.15*dt; // gravity
    p.life -= dt;
    p.alpha = p.life / p.maxLife;
    if (p.life <= 0) State.particles.splice(i,1);
  }
}

function updateExplosions(dt) {
  for (let i=State.explosions.length-1; i>=0; i--) {
    const e = State.explosions[i];
    e.r += 3*dt; e.life -= dt;
    e.alpha = e.life/e.maxLife;
    if (e.life<=0) State.explosions.splice(i,1);
  }
}

function updateCamera() {
  const p = State.player;
  const W = canvas.width, H = canvas.height;
  const targetX = p.x - W/2;
  const targetY = p.y - H/2;
  State.camera.x += (targetX - State.camera.x) * 0.1;
  State.camera.y += (targetY - State.camera.y) * 0.1;
  State.camera.x = Math.max(0, Math.min(State.WORLD.w - W, State.camera.x));
  State.camera.y = Math.max(0, Math.min(State.WORLD.h - H, State.camera.y));
}

function updateSpawning(dt) {
  State.spawnTimer += dt;
  if (State.spawnTimer >= State.spawnInterval) {
    State.spawnTimer = 0;
    spawnEnemyWave();
    if (State.enemiesKilled > 0 && State.enemiesKilled % 10 === 0) {
      State.waveNumber++;
      State.spawnInterval = Math.max(60, State.spawnInterval - 10);
      showNotif(`🌊 Wave ${State.waveNumber}!`, '');
    }
  }
}

function spawnEnemyWave() {
  const p = State.player;
  const count = 2 + State.waveNumber;
  for (let i=0; i<count; i++) {
    const angle = Math.random()*Math.PI*2;
    const dist  = 400 + Math.random()*300;
    spawnEnemy(
      p.x + Math.cos(angle)*dist,
      p.y + Math.sin(angle)*dist
    );
  }
}

function spawnEnemy(x, y) {
  const types = [
    { color:'#cc0000', hp:60,  speed:1.5, damage:20, fireRate:90,  r:12, name:'Gang' },
    { color:'#0066cc', hp:100, speed:1.2, damage:30, fireRate:120, r:14, name:'Police' },
    { color:'#884400', hp:150, speed:1.0, damage:45, fireRate:150, r:16, name:'Heavy' },
    { color:'#440088', hp:200, speed:0.8, damage:60, fireRate:200, r:18, name:'Boss' },
  ];
  const lvl = Math.min(3, Math.floor(State.waveNumber/3));
  const t   = types[Math.floor(Math.random()*(lvl+1))];
  State.enemies.push({
    ...t,
    x: Math.max(20,Math.min(State.WORLD.w-20,x)),
    y: Math.max(20,Math.min(State.WORLD.h-20,y)),
    angle: 0,
    shootTimer: Math.random()*t.fireRate,
    maxHp: t.hp,
  });
}

function updateWanted(dt) {
  const p = State.player;
  if (p.wantedLevel > 0) {
    p.wantedTimer -= dt;
    if (p.wantedTimer <= 0) {
      p.wantedLevel = Math.max(0, p.wantedLevel - 0.5);
      p.wantedTimer = 300;
    }
  }
  // Police spawn at high wanted
  if (p.wantedLevel >= 3) {
    State.policeSpawnTimer += dt;
    if (State.policeSpawnTimer > 200) {
      State.policeSpawnTimer = 0;
      const a = Math.random()*Math.PI*2;
      spawnEnemy(p.x+Math.cos(a)*500, p.y+Math.sin(a)*500);
    }
  }
  updateWantedHUD();
}

// ─── COMBAT ───────────────────────────────────────────────────
function tryShoot() {
  const p = State.player;
  const now = performance.now();
  const w = p.weapons[p.currentWeapon];
  if (p.reloading) return;
  if (w.clip <= 0) { reloadWeapon(); return; }
  if (now - p.lastShot < w.fireRate) return;

  p.lastShot = now;
  w.clip--;

  const wx = p.x - State.camera.x;
  const wy = p.y - State.camera.y;
  const angle = Math.atan2(State.mouse.y - wy, State.mouse.x - wx);

  if (w.name === 'SHOTGUN') {
    for (let i=-2; i<=2; i++) {
      const spread = (i * 0.12) + (Math.random()-0.5)*0.1;
      State.bullets.push({
        x: p.x, y: p.y,
        vx: Math.cos(angle+spread)*12,
        vy: Math.sin(angle+spread)*12,
        owner:'player', damage:w.damage/5,
        color: w.color, r:3, life:40,
      });
    }
  } else {
    const spread = (Math.random()-0.5)*0.06;
    State.bullets.push({
      x: p.x, y: p.y,
      vx: Math.cos(angle+spread)*14,
      vy: Math.sin(angle+spread)*14,
      owner:'player', damage:w.damage,
      color: w.color, r:4, life:60,
    });
  }

  // Muzzle flash particles
  spawnParticles(p.x, p.y, w.color, 4, 3);
  updateAmmoHUD();
}

function reloadWeapon() {
  const p = State.player;
  const w = p.weapons[p.currentWeapon];
  if (p.reloading || w.total <= 0 || w.clip === (w.name==='PISTOL'?15:w.name==='SMG'?30:8)) return;
  p.reloading = true;
  showNotif('🔄 Reloading...', '');
  setTimeout(() => {
    const need = (w.name==='PISTOL'?15:w.name==='SMG'?30:8) - w.clip;
    const take = Math.min(need, w.total);
    w.clip  += take;
    w.total -= take;
    p.reloading = false;
    updateAmmoHUD();
    showNotif('✅ Reloaded!', 'success');
  }, 1500);
}

function switchWeapon(idx) {
  if (idx >= State.player.weapons.length) return;
  State.player.currentWeapon = idx;
  const w = State.player.weapons[idx];
  document.getElementById('weaponIcon').textContent = w.icon;
  document.getElementById('weaponName').textContent = w.name;
  updateAmmoHUD();
}

function damagePlayer(dmg) {
  const p = State.player;
  if (p.invincible) return;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg * 0.6);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  p.health -= dmg;
  p.health = Math.max(0, p.health);
  p.invincible = true;
  p.invincibleTimer = 30;

  // Flash screen red
  flashScreen('#ff000033');

  if (p.health <= 0) triggerGameOver();
  updateHUD();
}

function flashScreen(color) {
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position:'fixed',inset:'0',
    background:color,pointerEvents:'none',
    zIndex:'100',transition:'opacity 0.3s',
  });
  document.body.appendChild(flash);
  setTimeout(()=>flash.style.opacity='0',50);
  setTimeout(()=>flash.remove(),350);
}

function tryEnterCar() {
  const p = State.player;
  if (p.inCar) {
    p.inCar = false; p.car = null;
    showNotif('🚶 Exited vehicle', '');
    return;
  }
  for (const c of State.cars) {
    const dx=p.x-c.x, dy=p.y-c.y;
    if (dx*dx+dy*dy < 60*60) {
      p.inCar = true; p.car = c; c.occupied = true;
      p.speed = c.speed;
      showNotif(`🚗 Entered ${c.name}`, 'success');
      return;
    }
  }
  showNotif('No vehicle nearby', '');
}

// ─── RENDER ───────────────────────────────────────────────────
function render() {
  const W = canvas.width, H = canvas.height;
  const cx = State.camera.x, cy = State.camera.y;

  ctx.clearRect(0,0,W,H);

  // Sky/ground
  ctx.fillStyle = '#0a1a0a';
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.translate(-cx, -cy);

  drawRoads();
  drawBuildings();
  drawCars();
  drawPickups();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawExplosions();

  ctx.restore();

  drawMinimap();
}

function drawRoads() {
  ctx.fillStyle = '#1a1a1a';
  for (const r of State.roads) {
    if (r.horiz) ctx.fillRect(r.x1, r.y1-r.w/2, r.x2-r.x1, r.w);
    else         ctx.fillRect(r.x1-r.w/2, r.y1, r.w, r.y2-r.y1);
  }
  // Lane markings
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.setLineDash([30,20]);
  for (const r of State.roads) {
    ctx.beginPath();
    if (r.horiz) { ctx.moveTo(r.x1,r.y1); ctx.lineTo(r.x2,r.y1); }
    else         { ctx.moveTo(r.x1,r.y1); ctx.lineTo(r.x1,r.y2); }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildings() {
  for (const b of State.buildings) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x+8, b.y+8, b.w, b.h);
    // Body
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Top edge (3D effect)
    ctx.fillStyle = lightenColor(b.color, 30);
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillRect(b.x, b.y, 8, b.h);
    // Windows
    ctx.fillStyle = 'rgba(255,220,100,0.3)';
    for (let wy=b.y+15; wy<b.y+b.h-10; wy+=18) {
      for (let wx=b.x+10; wx<b.x+b.w-8; wx+=14) {
        if (Math.sin(wx*wy)>0) ctx.fillRect(wx,wy,7,9);
      }
    }
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x,b.y,b.w,b.h);
  }
}

function drawCars() {
  for (const c of State.cars) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-c.h/2+4, -c.w/2+4, c.h, c.w);
    // Body
    ctx.fillStyle = c.color;
    ctx.fillRect(-c.h/2, -c.w/2, c.h, c.w);
    // Windshield
    ctx.fillStyle = 'rgba(150,220,255,0.5)';
    ctx.fillRect(c.h/2-10, -c.w/2+3, 8, c.w-6);
    // Wheels
    ctx.fillStyle = '#111';
    [[-c.h/2+2,-c.w/2-3],[c.h/2-6,-c.w/2-3],
     [-c.h/2+2, c.w/2-1],[c.h/2-6, c.w/2-1]].forEach(([wx,wy])=>{
      ctx.fillRect(wx,wy,6,4);
    });
    ctx.restore();
    // Name label
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(c.name, c.x, c.y - 20);
  }
}

function drawPickups() {
  for (const pk of State.pickups) {
    const bob = Math.sin(pk.pulse)*3;
    // Glow
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = pk.color;
    ctx.font = `${20+Math.sin(pk.pulse)*2}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.icon, pk.x, pk.y + bob);
    ctx.restore();
    // Label
    ctx.fillStyle = pk.color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pk.label === '+$' ? `+$${pk.value}` : pk.label, pk.x, pk.y+bob+18);
  }
}

function drawBullets() {
  for (const b of State.bullets) {
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemies() {
  for (const e of State.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3,3,e.r,e.r*0.6,0,0,Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0,0,e.r,0,Math.PI*2);
    ctx.fill();

    // Face direction indicator
    ctx.rotate(e.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(e.r*0.6,0,3,0,Math.PI*2);
    ctx.fill();

    ctx.restore();

    // Health bar
    const barW = e.r*2.5;
    ctx.fillStyle = '#333';
    ctx.fillRect(e.x-barW/2, e.y-e.r-10, barW, 4);
    ctx.fillStyle = e.hp/e.maxHp > 0.5 ? '#76ff03' : e.hp/e.maxHp > 0.25 ? '#ff9800' : '#ff1744';
    ctx.fillRect(e.x-barW/2, e.y-e.r-10, barW*(e.hp/e.maxHp), 4);

    // Name
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, e.x, e.y-e.r-14);
  }
}

function drawPlayer() {
  const p = State.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Invincibility flash
  if (p.invincible && Math.floor(State.gameTime/5)%2===0) {
    ctx.globalAlpha = 0.5;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(4,4,14,10,0,0,Math.PI*2);
  ctx.fill();

  // Body
  ctx.fillStyle = p.inCar ? '#f5c518' : '#00e676';
  ctx.beginPath();
  ctx.arc(0,0,14,0,Math.PI*2);
  ctx.fill();

  // Gold ring
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0,0,14,0,Math.PI*2);
  ctx.stroke();

  // Aim direction + gun
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.fillRect(8,-3,16,6);
  ctx.fillStyle = '#aaa';
  ctx.fillRect(22,-2,8,4);

  ctx.restore();

  // Player name
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(p.name, p.x, p.y - 22);
}

function drawParticles() {
  for (const p of State.particles) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawExplosions() {
  for (const e of State.explosions) {
    ctx.save();
    ctx.globalAlpha = e.alpha * 0.5;
    const grad = ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.r);
    grad.addColorStop(0,'#fff');
    grad.addColorStop(0.3,'#ff6b00');
    grad.addColorStop(1,'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x,e.y,e.r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMinimap() {
  const mc = minimapCtx;
  const mw=160, mh=160;
  const scale = mw / State.WORLD.w;

  mc.fillStyle = '#0a1a0a';
  mc.fillRect(0,0,mw,mh);

  // Roads
  mc.fillStyle = '#222';
  for (const r of State.roads) {
    if (r.horiz) mc.fillRect(0, (r.y1-r.w/2)*scale, mw, r.w*scale);
    else         mc.fillRect((r.x1-r.w/2)*scale, 0, r.w*scale, mh);
  }

  // Buildings
  mc.fillStyle = '#333';
  for (const b of State.buildings) {
    mc.fillRect(b.x*scale, b.y*scale, b.w*scale, b.h*scale);
  }

  // Pickups
  mc.fillStyle = '#f5c518';
  for (const pk of State.pickups) {
    mc.fillRect(pk.x*scale-1, pk.y*scale-1, 3, 3);
  }

  // Enemies
  mc.fillStyle = '#ff1744';
  for (const e of State.enemies) {
    mc.beginPath();
    mc.arc(e.x*scale, e.y*scale, 2, 0, Math.PI*2);
    mc.fill();
  }

  // Player
  mc.fillStyle = '#00e676';
  mc.beginPath();
  mc.arc(State.player.x*scale, State.player.y*scale, 3, 0, Math.PI*2);
  mc.fill();
}

// ─── HUD UPDATE ───────────────────────────────────────────────
function updateHUD() {
  const p = State.player;
  document.getElementById('healthFill').style.width = p.health+'%';
  document.getElementById('armorFill').style.width  = p.armor+'%';
  document.getElementById('healthVal').textContent  = Math.ceil(p.health);
  document.getElementById('armorVal').textContent   = Math.ceil(p.armor);
  document.getElementById('moneyVal').textContent   = p.money.toLocaleString();
  document.getElementById('scoreVal').textContent   = State.score.toLocaleString();
  updateAmmoHUD();
}

function updateAmmoHUD() {
  const w = State.player.weapons[State.player.currentWeapon];
  document.getElementById('ammoClip').textContent  = w.clip;
  document.getElementById('ammoTotal').textContent = w.total;
  document.getElementById('weaponIcon').textContent = w.icon;
  document.getElementById('weaponName').textContent = w.name;
}

function updateWantedHUD() {
  const level = Math.floor(State.player.wantedLevel);
  const stars = document.getElementById('wantedStars');
  let html='';
  for (let i=0;i<5;i++) {
    html += `<span style="color:${i<level?'#f5c518':'#333'}">★</span>`;
  }
  stars.innerHTML = html;
}

function updateClock() {
  const hrs = Math.floor((12 + State.gameSeconds/60) % 24);
  const min = State.gameSeconds % 60;
  document.getElementById('gameTime').textContent =
    `${String(hrs).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}

function setMission(idx) {
  if (idx >= MISSIONS.length) idx = MISSIONS.length-1;
  State.currentMission = idx;
  State.missionProgress = 0;
  const m = MISSIONS[idx];
  document.getElementById('missionName').textContent = m.name;
  document.getElementById('missionObj').textContent  = m.obj;
  document.getElementById('missionFill').style.width = '0%';
  showNotif(`📋 Mission: ${m.name}`, '');
}

function checkMissionProgress(type, amount) {
  const p = State.player;
  const m = MISSIONS[State.currentMission];
  if (!m) return;

  if (type==='kill') {
    State.missionProgress++;
    const pct = (State.missionProgress/m.target)*100;
    document.getElementById('missionFill').style.width = Math.min(100,pct)+'%';
    if (State.missionProgress >= m.target) completeMission();
  }
  if (type==='money' && State.currentMission===2) {
    State.missionProgress++;
    const pct = (State.missionProgress/m.target)*100;
    document.getElementById('missionFill').style.width = Math.min(100,pct)+'%';
    if (State.missionProgress >= m.target) completeMission();
  }
}

function completeMission() {
  const m = MISSIONS[State.currentMission];
  const bonus = 5000 * (State.currentMission+1);
  State.player.money += bonus;
  State.score += 1000 * (State.currentMission+1);
  showNotif(`🏆 Mission Complete! +$${bonus.toLocaleString()}`, 'success');
  document.getElementById('missionFill').style.width = '100%';
  setTimeout(()=>setMission(State.currentMission+1), 2000);
  postScore();
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function showNotif(msg, type='') {
  const area = document.getElementById('notifications');
  const el   = document.createElement('div');
  el.className = `notif-item ${type}`;
  el.textContent = msg;
  area.prepend(el);
  setTimeout(()=>el.remove(), 3200);
}

// ─── PARTICLES ────────────────────────────────────────────────
function spawnParticles(x, y, color, count=8, speed=5) {
  for (let i=0;i<count;i++) {
    const angle = Math.random()*Math.PI*2;
    const spd   = speed * (0.5 + Math.random()*1.5);
    State.particles.push({
      x, y, color,
      vx: Math.cos(angle)*spd,
      vy: Math.sin(angle)*spd,
      r: 2+Math.random()*3,
      life: 20+Math.random()*20,
      maxLife: 40,
      alpha: 1,
    });
  }
}

// ─── GAME CONTROL ─────────────────────────────────────────────
function pauseGame() {
  State.paused = true;
  document.getElementById('pauseMenu').classList.remove('hidden');
}
function resumeGame() {
  State.paused = false;
  document.getElementById('pauseMenu').classList.add('hidden');
  lastTime = performance.now();
}
function saveGame() {
  const save = {
    score: State.score,
    money: State.player.money,
    kills: State.player.kills,
    wave:  State.waveNumber,
    ts:    Date.now(),
  };
  localStorage.setItem('gta_save', JSON.stringify(save));
  showNotif('💾 Game saved!', 'success');
}
function quitToMenu() {
  State.gameRunning = false;
  State.paused = false;
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('pauseMenu').classList.add('hidden');
  document.getElementById('gameOver').classList.add('hidden');
  document.getElementById('mainMenu').classList.remove('hidden');
  postScore();
}
function triggerGameOver() {
  State.gameRunning = false;
  const go = document.getElementById('gameOver');
  go.classList.remove('hidden');
  const p = State.player;
  const secs = Math.floor(State.gameSeconds);
  document.getElementById('gameoverStats').innerHTML = `
    <div>Score: <span>${State.score.toLocaleString()}</span></div>
    <div>Money: <span>$${p.money.toLocaleString()}</span></div>
    <div>Kills: <span>${p.kills}</span></div>
    <div>Wave: <span>${State.waveNumber}</span></div>
    <div>Time: <span>${Math.floor(secs/60)}m ${secs%60}s</span></div>
  `;
  postScore();
}

// ─── API ──────────────────────────────────────────────────────
async function postScore() {
  try {
    await fetch(`${API_BASE}/scores`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        name:  State.player.name,
        score: State.score,
        money: State.player.money,
        kills: State.player.kills,
        wave:  State.waveNumber,
      }),
    });
  } catch {}
}

// ─── MODALS ───────────────────────────────────────────────────
async function showLeaderboard() {
  document.getElementById('leaderboardModal').classList.remove('hidden');
  const list = document.getElementById('leaderboardList');
  list.innerHTML = '<div style="text-align:center;padding:20px;color:#666">Loading...</div>';
  try {
    const r = await fetch(`${API_BASE}/scores/top`);
    const data = r.ok ? await r.json() : [];
    if (!data.length) throw new Error('empty');
    list.innerHTML = data.map((p,i)=>`
      <div class="lb-item">
        <span class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">#${i+1}</span>
        <span class="lb-name">${p.name}</span>
        <span class="lb-score">${Number(p.score).toLocaleString()}</span>
      </div>
    `).join('');
  } catch {
    // Demo fallback
    const demo = [
      {name:'Trevor Phillips',score:985420},
      {name:'Michael De Santa',score:742000},
      {name:'Franklin Clinton',score:531800},
      {name:'Lamar Davis',score:320500},
      {name:'Los Santos Pro',score:210000},
    ];
    list.innerHTML = demo.map((p,i)=>`
      <div class="lb-item">
        <span class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">#${i+1}</span>
        <span class="lb-name">${p.name}</span>
        <span class="lb-score">${p.score.toLocaleString()}</span>
      </div>
    `).join('');
  }
}

function showProfile() {
  document.getElementById('profileModal').classList.remove('hidden');
  document.getElementById('playerNameInput').value = State.player.name;
  const save = JSON.parse(localStorage.getItem('gta_save')||'{}');
  document.getElementById('profileInfo').innerHTML = save.score ? `
    <div>Best Score: <span>${Number(save.score).toLocaleString()}</span></div>
    <div>Best Wave: <span>${save.wave||1}</span></div>
    <div>Money Earned: <span>$${Number(save.money||0).toLocaleString()}</span></div>
  ` : '<div style="color:#666;text-align:center">No save data yet. Play a game!</div>';
}

function saveProfile() {
  const name = document.getElementById('playerNameInput').value.trim() || 'Player';
  State.player.name = name;
  localStorage.setItem('gta_player_name', name);
  showNotif(`Profile saved: ${name}`, 'success');
}

function showGarage() {
  document.getElementById('garageModal').classList.remove('hidden');
  const vehicles = [
    { name:'Sultan RS',  icon:'🚗', speed:'★★★☆☆', armor:'★★☆☆☆', unlocked:true },
    { name:'Infernus',   icon:'🏎️', speed:'★★★★★', armor:'★☆☆☆☆', unlocked:true },
    { name:'Mesa',       icon:'🚙', speed:'★★☆☆☆', armor:'★★★★☆', unlocked:true },
    { name:'NRG-500',    icon:'🏍️', speed:'★★★★★', armor:'★☆☆☆☆', unlocked:true },
    { name:'Rhino',      icon:'🚛', speed:'★★☆☆☆', armor:'★★★★★', unlocked:false },
    { name:'Hydra',      icon:'✈️', speed:'★★★★★', armor:'★★★☆☆', unlocked:false },
  ];
  document.getElementById('garageGrid').innerHTML = vehicles.map(v=>`
    <div class="garage-card ${v.unlocked?'':'locked'}">
      <div class="garage-car-icon">${v.icon}</div>
      <div class="garage-car-name">${v.name}</div>
      <div class="garage-car-stat">SPD ${v.speed}</div>
      <div class="garage-car-stat">ARM ${v.armor}</div>
      ${!v.unlocked?'<div style="color:#ff1744;font-size:0.7rem;margin-top:5px">🔒 LOCKED</div>':''}
    </div>
  `).join('');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ─── HELPERS ─────────────────────────────────────────────────
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function lightenColor(hex, amt) {
  try {
    const num = parseInt(hex.replace('#',''),16);
    const r = Math.min(255,((num>>16)&0xff)+amt);
    const g = Math.min(255,((num>>8)&0xff)+amt);
    const b = Math.min(255,(num&0xff)+amt);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}
