# Hosting Recommendations for Iris/Suna

## Quick Summary

**Best Cost-Performance: Hetzner Cloud**
- 32GB RAM, 16 vCPU: ~$50-80/month
- Excellent value in Europe
- Use location closest to your users

**Production Ready: DigitalOcean**
- 32GB RAM, 16 vCPU: ~$120-150/month
- Global regions, great performance
- Excellent documentation

**Enterprise: AWS**
- More expensive (~$150-200/month) but most scalable
- Best if you need integrations with other AWS services

## Detailed Breakdown

### Option 1: Hetzner Cloud (Recommended for Cost)

**Server Specs:**
- **CPX41**: 16 vCPU, 32 GB RAM, 360 GB SSD - **~$60/month**
- **CPX51**: 32 vCPU, 64 GB RAM, 600 GB SSD - **~$120/month** (for high traffic)

**Setup Steps:**
1. Create account at https://hetzner.com
2. Create new project → Cloud → Add Server
3. Choose Ubuntu 22.04, location closest to users
4. SSH into server and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Clone your repo
git clone https://github.com/yourusername/irissecond.git
cd irissecond

# Configure environment
cd backend && nano .env
cd ../frontend && nano .env.local

# Start services
docker compose up -d --build

# Check logs
docker compose logs -f
```

**Expected Monthly Cost:**
- Server: $60/month
- Supabase: Free tier (or $25/month for better plan)
- Domain: $10/year
- **Total: ~$60-85/month**

---

### Option 2: DigitalOcean (Recommended for Ease)

**Droplet Specs:**
- **Premium AMD 16GB**: 4 vCPU, 16 GB RAM - **~$72/month** (start here)
- **Premium AMD 32GB**: 8 vCPU, 32 GB RAM - **~$144/month** (scale to this)

**Benefits:**
- One-click apps and tutorials
- Global data centers
- Managed databases available
- Great documentation

**Setup:**
1. Create account at https://digitalocean.com
2. Create Droplet → Marketplace → Docker on Ubuntu
3. Same setup as Hetzner (follow steps above)
4. Deploy from GitHub using App Platform for easier deployment

---

### Option 3: AWS EC2 (Most Scalable)

**Instance Types:**
- **t3.xlarge**: 4 vCPU, 16 GB RAM - **~$150/month** (on-demand)
- **t3.2xlarge**: 8 vCPU, 32 GB RAM - **~$300/month**
- **Reserved Instances**: ~40% cheaper (1-year commitment)

**Setup:**
1. AWS Account → EC2 Dashboard
2. Launch Instance → Ubuntu 22.04 LTS
3. Choose t3.xlarge or t3.2xlarge
4. Add security group rules (ports 22, 80, 443, 8000)
5. Same Docker setup as above

**Note:** Consider separate managed services:
- **ElastiCache** for Redis: ~$50/month
- **RDS** for PostgreSQL: ~$50/month
- **EC2** for app: ~$100/month
- **Total: ~$200-300/month**

---

### Option 4: Railway (Easiest Deployment)

**Pricing:**
- Startup plan: $20/month + $10/month per service
- You have ~4 services (backend, worker, frontend, redis)
- **Total: ~$60-100/month**

**Pros:**
- GitHub integration (auto-deploy on push)
- Auto-scaling
- Managed databases included

**Setup:**
1. Connect GitHub repo
2. Add services: backend, worker, frontend
3. Add Redis from marketplace
4. Configure environment variables
5. Deploy

---

### Option 5: Fly.io (Good Performance)

**Pricing:**
- VM with 8GB RAM: ~$30/month per service
- **Total: ~$120-140/month for full stack**

**Pros:**
- Edge deployment (closest to users)
- Auto-scaling
- Built-in monitoring

**Setup:**
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy each service
cd backend && fly launch
cd ../frontend && fly launch
```

---

## Resource Requirements

Based on your Docker configuration:

| Service | CPU | RAM | Notes |
|---------|-----|-----|-------|
| Backend API | 2-4 vCPU | 2GB | Configured for 16 vCPU, 7 workers |
| Worker | 4-8 vCPU | 4GB | 4 processes × 4 threads |
| Frontend | 1-2 vCPU | 1GB | Static optimized |
| Redis | 1 vCPU | 4-8GB | Max 8GB configured |
| Caddy | 0.5 vCPU | 0.5GB | Lightweight |
| **Total Minimum** | **8-16 vCPU** | **16-32GB** | Recommend 32GB |

---

## Infrastructure Stack Split (Cost Optimization)

Instead of one big server, consider:

### Tier 1: Budget Option (~$70/month)
- **1 VPS**: Hetzner CPX41 (16 vCPU, 32GB) - $60/month
- **Supabase**: Free tier
- **Total: ~$70/month**

### Tier 2: Managed Services (~$120/month)
- **1 VPS**: Hetzner CPX41 - $60/month
- **Upstash Redis**: $10/month (managed, auto-scaling)
- **Supabase Pro**: $25/month
- **Total: ~$95/month**

### Tier 3: Full Managed (~$200/month)
- **Railway**: $100/month (auto-scaling, GitHub integration)
- **Upstash Redis**: $10/month
- **Supabase Pro**: $25/month
- **Domain**: $1/month
- **Total: ~$136/month**

---

## My Recommendation

**For MVP/Starting Out:**
1. **Hetzner CPX41** (16 vCPU, 32GB) - $60/month
2. Use Supabase free tier
3. Self-host Redis in Docker
4. **Total: ~$70/month**

**For Production (100+ users):**
1. **DigitalOcean 32GB Premium** - $144/month
2. Managed Redis on DigitalOcean - $15/month
3. Supabase Pro - $25/month
4. CDN (Cloudflare free tier)
5. **Total: ~$184/month**

**For Scale (1000+ users):**
1. Split across multiple servers:
   - API servers (2×): $144/month each
   - Dedicated Redis: $60/month
   - Supabase Team: $50/month
2. Use AWS/GCP for redundancy
3. **Total: ~$400-600/month**

---

## Quick Start Commands

Once you have a server, run these:

```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo apt install docker-compose-plugin git -y

# Clone your repo
git clone https://github.com/yourusername/irissecond.git
cd irissecond

# Configure environment files
cd backend && cp .env.example .env && nano .env
cd ../frontend && cp .env.local.example .env.local && nano .env.local

# Deploy
docker compose up -d --build

# Check status
docker compose ps
docker compose logs -f

# View API
curl http://localhost:8000/health
```

---

## Monitoring & Maintenance

**Essential Tools:**
- **Uptime monitoring**: UptimeRobot (free) or BetterStack ($10/month)
- **Logs**: Use `docker compose logs -f` or deploy Grafana
- **Backups**: Automated Supabase backups (included) + server snapshots

**Hetzner Backup Pricing:**
- 20% of server cost (~$12/month for automatic daily snapshots)

---

## Future Scaling Path

1. **Single Server** → Works for 1-100 concurrent users
2. **Add Redis Replication** → Works for 100-500 users
3. **Separate Workers** → Scale background jobs independently
4. **Load Balancer + Multiple Backends** → 1000+ users
5. **Microservices Split** → Dedicated services per function

Start with Tier 1, monitor usage, scale up as needed.

---

## Additional Considerations

- **CDN**: Use Cloudflare (free) for frontend static assets
- **SSL**: Already handled by Caddy (auto Let's Encrypt)
- **Database**: Supabase handles scaling automatically
- **Email**: Use Supabase Auth built-in email
- **Monitoring**: Set up health checks at `/health` endpoint

**Expected Traffic Capacity:**
- Single 16 vCPU server can handle ~500-1000 concurrent connections
- With Redis caching: 2000-5000 requests/minute
- Background workers can process 50-100 agent tasks simultaneously



