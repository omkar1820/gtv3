# 🎮 GTA V — Los Santos Online

> A full-stack GTA 5-inspired browser game with complete DevOps infrastructure.

---

## 📁 PROJECT STRUCTURE

```
gta5-game/
├── frontend/                   # Browser game (HTML5 Canvas)
│   ├── index.html              # Game UI & HUD
│   ├── style.css               # GTA-themed styling
│   └── game.js                 # Full game engine (2D top-down)
│
├── backend/                    # REST API
│   ├── server.js               # Node.js + Express + PostgreSQL
│   └── package.json
│
├── database/
│   └── init.sql                # PostgreSQL schema + seed data
│
├── docker/
│   └── nginx.conf              # Nginx configuration
│
├── kubernetes/
│   └── k8s-all.yaml            # All K8s manifests (Namespace → HPA)
│
├── terraform/
│   └── main.tf                 # AWS EKS + RDS + ElastiCache + ECR
│
├── .github/workflows/
│   └── cicd.yml                # GitHub Actions CI/CD pipeline
│
├── Dockerfile.frontend         # Nginx + static files
├── Dockerfile.backend          # Node.js multi-stage build
└── docker-compose.yml          # Full local stack
```

---

## 🛠️ TECH STACK

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | HTML5 Canvas, Vanilla JS, CSS3      |
| Backend    | Node.js 20, Express 4, JWT, bcrypt  |
| Database   | PostgreSQL 16                       |
| Cache      | Redis 7                             |
| Container  | Docker, Docker Compose              |
| Orchestration | Kubernetes (EKS)                 |
| Infrastructure | Terraform (AWS)               |
| CI/CD      | GitHub Actions                      |
| Proxy      | Nginx 1.25                          |

---

## 🚀 HOW TO RUN

### Option 1 — Docker Compose (Recommended, Easiest)

```bash
# 1. Clone the project
git clone https://github.com/yourname/gta5-game.git
cd gta5-game

# 2. Start all services (frontend + backend + postgres + redis)
docker-compose up --build

# 3. Open your browser
open http://localhost         # Game
open http://localhost:3000/health  # API health
open http://localhost:5050    # pgAdmin (admin@gta5.com / admin123)

# Stop everything
docker-compose down

# Stop + remove volumes (fresh start)
docker-compose down -v
```

**Services started:**
| Service   | URL                        |
|-----------|----------------------------|
| Game      | http://localhost            |
| API       | http://localhost:3000       |
| pgAdmin   | http://localhost:5050       |
| Redis UI  | http://localhost:8081       |

To start with database tools:
```bash
docker-compose --profile tools up --build
```

---

### Option 2 — Local Development (No Docker)

#### Prerequisites
- Node.js 18+
- PostgreSQL 16
- Redis 7

```bash
# 1. Setup PostgreSQL
psql -U postgres << 'EOF'
CREATE DATABASE gta5game;
CREATE USER gta5user WITH PASSWORD 'gta5pass';
GRANT ALL PRIVILEGES ON DATABASE gta5game TO gta5user;
EOF
psql -U gta5user -d gta5game -f database/init.sql

# 2. Start Redis
redis-server

# 3. Start Backend
cd backend
npm install
DB_HOST=localhost DB_USER=gta5user DB_PASSWORD=gta5pass npm start

# 4. Serve Frontend (any static server)
cd frontend
npx serve .          # or: python3 -m http.server 8080
# Open: http://localhost:3000
```

---

### Option 3 — Kubernetes (Production)

#### Prerequisites
- kubectl configured
- A running Kubernetes cluster (minikube, k3s, EKS, GKE, AKS)

```bash
# 1. Build and push images to your registry
docker build -t yourregistry/gta5-backend:latest  -f Dockerfile.backend  .
docker build -t yourregistry/gta5-frontend:latest -f Dockerfile.frontend .
docker push yourregistry/gta5-backend:latest
docker push yourregistry/gta5-frontend:latest

# 2. Update image references in kubernetes/k8s-all.yaml
# Replace: image: gta5-backend:latest
# With:    image: yourregistry/gta5-backend:latest

# 3. Apply all manifests
kubectl apply -f kubernetes/k8s-all.yaml

# 4. Watch rollout
kubectl get pods -n gta5-game -w

# 5. Get external IP
kubectl get svc frontend-service -n gta5-game

# ── Minikube quickstart ──
minikube start
kubectl apply -f kubernetes/k8s-all.yaml
minikube service frontend-service -n gta5-game --url
```

---

### Option 4 — Terraform on AWS

```bash
# Prerequisites: AWS CLI configured, Terraform 1.6+

cd terraform

# 1. Initialize
terraform init

# 2. Review the plan
terraform plan -var="db_password=YourSecurePassword123"

# 3. Apply (creates EKS, RDS, ElastiCache, ECR, VPC)
terraform apply -var="db_password=YourSecurePassword123"

# 4. Configure kubectl
aws eks update-kubeconfig --name gta5-eks-cluster --region us-east-1

# 5. Deploy the game
kubectl apply -f kubernetes/k8s-all.yaml

# 6. Destroy when done
terraform destroy -var="db_password=YourSecurePassword123"
```

**AWS Resources Created:**
- VPC + subnets (public/private) + NAT gateway
- EKS cluster (3 × t3.medium nodes, autoscales to 6)
- RDS PostgreSQL 16 (t3.micro)
- ElastiCache Redis 7 (t3.micro)
- ECR repositories (backend + frontend)

---

### Option 5 — CI/CD Pipeline (GitHub Actions)

```bash
# 1. Fork/clone and push to GitHub

# 2. Add GitHub Secrets:
#    AWS_ACCOUNT_ID      → your 12-digit AWS account ID
#    AWS_ACCESS_KEY_ID   → IAM access key
#    AWS_SECRET_ACCESS_KEY → IAM secret key
#    DB_PASSWORD         → secure postgres password

# 3. Push to main → triggers full pipeline:
#    ✅ Lint & test backend
#    ✅ Validate K8s manifests
#    ✅ Validate Terraform
#    🐳 Build Docker images (multi-arch)
#    🔍 Security scan (Trivy)
#    🚀 Deploy to staging
#    🏆 Deploy to production (on release tag)

# Create a release to trigger production deploy:
git tag v2.0.1
git push origin v2.0.1
# Then create a GitHub Release from the tag
```

---

## 🎮 GAME CONTROLS

| Key           | Action              |
|---------------|---------------------|
| WASD / Arrows | Move character      |
| Mouse         | Aim                 |
| Left Click    | Shoot               |
| E             | Enter/exit vehicle  |
| R             | Reload weapon       |
| 1 / 2 / 3     | Switch weapon       |
| Shift         | Sprint              |
| ESC           | Pause menu          |

---

## 🔌 API ENDPOINTS

```
GET  /health                  → Health check
GET  /api/players/online      → Online player count
POST /api/scores              → Submit score  { name, score, money, kills, wave }
GET  /api/scores/top          → Leaderboard top 10
GET  /api/scores/:name        → Player scores
POST /api/players/register    → Register player
POST /api/players/login       → Login
GET  /api/stats               → Global game statistics
```

---

## 🗄️ DATABASE

**PostgreSQL 16 — Schema:**
- `players`     → user accounts
- `scores`      → game results & leaderboard
- `sessions`    → JWT session tracking
- `game_events` → analytics events
- `missions`    → mission definitions

**Redis 7 — Used for:**
- Leaderboard caching (30s TTL)
- Session management
- Rate limiting

---

## 🔐 ENVIRONMENT VARIABLES

```env
# Backend
PORT=3000
NODE_ENV=production
DB_HOST=postgres
DB_PORT=5432
DB_NAME=gta5game
DB_USER=gta5user
DB_PASSWORD=gta5pass
REDIS_URL=redis://redis:6379
JWT_SECRET=change-me-in-production
```

---

## 📊 ARCHITECTURE

```
Browser
  │
  ▼
Nginx (port 80)           ← Serves frontend
  │  /api/* → proxy
  ▼
Node.js API (port 3000)
  ├── PostgreSQL (port 5432)  ← Scores, Players, Events
  └── Redis (port 6379)       ← Cache, Sessions
```

---

*Built with ❤️ in Los Santos, San Andreas*
