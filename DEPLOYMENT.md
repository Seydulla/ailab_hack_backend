# Deployment Guide for ailab.seydulla.com

This guide covers the complete setup and deployment process for the AILab Hack Backend on an Ubuntu VM.

## Prerequisites

- Ubuntu 22.04 LTS or later
- Root or sudo access
- Domain `ailab.seydulla.com` pointing to your VM's IP address
- Git repository access

## Quick Setup (Automated)

For a quick automated setup, you can use the setup script:

```bash
# Clone the repository first
git clone <your-repository-url>
cd ailab_hack_backend

# Run the automated setup script
./scripts/setup-server.sh
```

The script will automatically install:

- Node.js 22 LTS
- Yarn
- PM2
- Docker & Docker Compose V2
- Nginx
- Certbot (Let's Encrypt)
- Basic tools and firewall configuration

**Note:** After running the script, you may need to log out and log back in for Docker group changes to take effect.

## Manual Setup (Step by Step)

If you prefer manual setup or want to understand each step:

## Step 1: Initial Server Setup

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Required Tools

```bash
sudo apt install -y curl git build-essential
```

## Step 2: Install Node.js and Yarn

### Install Node.js (v22 LTS - Latest)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:

```bash
node --version  # Should show v22.x.x or higher
npm --version
```

### Install Yarn

```bash
npm install -g yarn
```

Verify installation:

```bash
yarn --version
```

## Step 3: Install PM2

```bash
sudo npm install -g pm2
```

Configure PM2 to start on boot:

```bash
pm2 startup
```

Follow the instructions provided by the command to enable PM2 on system startup.

## Step 4: Install Docker and Docker Compose

### Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

Log out and log back in for group changes to take effect, or run:

```bash
newgrp docker
```

### Install Docker Compose V2

Docker Compose V2 is included with Docker Desktop and as a plugin. Install it as a plugin:

```bash
sudo apt install -y docker-compose-plugin
```

Verify installation:

```bash
docker --version
docker compose version
```

Note: Docker Compose V2 uses `docker compose` (with space) instead of `docker-compose` (with hyphen).

## Step 5: Install and Configure Nginx

### Install Nginx

```bash
sudo apt install -y nginx
```

### Copy Nginx Configuration

```bash
sudo cp nginx/ailab.seydulla.com.conf /etc/nginx/sites-available/ailab.seydulla.com
sudo ln -s /etc/nginx/sites-available/ailab.seydulla.com /etc/nginx/sites-enabled/
```

### Test Nginx Configuration

```bash
sudo nginx -t
```

## Step 6: Install Certbot and Obtain SSL Certificate

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificate

```bash
sudo certbot --nginx -d ailab.seydulla.com
```

Follow the prompts to complete the SSL certificate setup. Certbot will automatically configure Nginx.

### Set Up Auto-Renewal

Certbot creates a cron job automatically, but verify it exists:

```bash
sudo certbot renew --dry-run
```

## Step 7: Clone and Setup Application

### Clone Repository

```bash
cd /opt
sudo git clone <your-repository-url> ailab_hack_backend
sudo chown -R $USER:$USER ailab_hack_backend
cd ailab_hack_backend
```

**Alternative:** If you've already cloned the repo and want to run the automated setup:

```bash
./scripts/setup-server.sh
```

### Create Environment File

```bash
cp env.production.example .env
nano .env
```

Update the following variables:

- `DATABASE_URL`: PostgreSQL connection string
- `QDRANT_URL`: Your Qdrant cloud URL
- `QDRANT_API_KEY`: Your Qdrant API key
- `GEMINI_API_KEY`: Your Google Gemini API key
- `REDIS_URL`: Redis connection string (default: `redis://localhost:6379`)
- Update `POSTGRES_PASSWORD` and `REDIS_PASSWORD` with secure passwords

### Create Logs Directory

```bash
mkdir -p logs
```

## Step 8: Start Docker Services

### Start PostgreSQL and Redis

```bash
docker compose -f docker-compose.prod.yml up -d
```

Verify services are running:

```bash
docker compose -f docker-compose.prod.yml ps
```

### Initialize Database Schema

The database schema will be automatically initialized from `schema.sql` on first startup.

## Step 9: Build and Start Application

### Install Dependencies

```bash
yarn install
```

### Build TypeScript

```bash
yarn build
```

### Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
```

### Check Application Status

```bash
pm2 status
pm2 logs ailab-hack-backend
```

### Verify Health Endpoint

```bash
curl http://localhost:3000/health
```

## Step 10: Configure Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 11: Verify Deployment

1. Check application logs: `pm2 logs ailab-hack-backend`
2. Check Docker services: `docker-compose -f docker-compose.prod.yml ps`
3. Check Nginx status: `sudo systemctl status nginx`
4. Test HTTPS endpoint: `curl https://ailab.seydulla.com/health`
5. Visit in browser: `https://ailab.seydulla.com/health`

## Ongoing Deployment Workflow

### Deploy Updates

Simply run the deployment script (automatically handles git pull, build, PM2 restart, and Nginx reload):

```bash
./scripts/deploy.sh
```

The deployment script will:

- Pull latest code from git
- Install dependencies
- Build TypeScript
- Sync and reload Nginx configuration
- Restart PM2 process
- Verify health endpoint

Or manually:

```bash
git pull
yarn install
yarn build
sudo cp nginx/ailab.seydulla.com.conf /etc/nginx/sites-available/ailab.seydulla.com
sudo ln -sf /etc/nginx/sites-available/ailab.seydulla.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
pm2 restart ecosystem.config.js
```

### Useful Commands

**PM2:**

```bash
pm2 status                    # Check status
pm2 logs ailab-hack-backend   # View logs
pm2 restart ailab-hack-backend # Restart app
pm2 stop ailab-hack-backend   # Stop app
pm2 monit                     # Monitor resources
```

**Docker:**

```bash
docker compose -f docker-compose.prod.yml ps      # Check services
docker compose -f docker-compose.prod.yml logs -f  # View logs
docker compose -f docker-compose.prod.yml restart  # Restart services
docker compose -f docker-compose.prod.yml down    # Stop services
```

**Nginx:**

```bash
sudo nginx -t                          # Test configuration
sudo systemctl reload nginx            # Reload configuration
sudo systemctl status nginx            # Check status
sudo tail -f /var/log/nginx/ailab.seydulla.com.error.log  # View error logs
```

**SSL Certificate:**

```bash
sudo certbot renew --dry-run           # Test renewal
sudo certbot certificates               # List certificates
```

## Troubleshooting

### Application Won't Start

1. Check PM2 logs: `pm2 logs ailab-hack-backend`
2. Verify environment variables: `cat .env`
3. Check database connection: `docker compose -f docker-compose.prod.yml ps`
4. Verify build: `ls -la dist/`

### Database Connection Issues

1. Check PostgreSQL is running: `docker compose -f docker-compose.prod.yml ps`
2. Test connection: `docker exec -it ailab_hack_postgres psql -U postgres -d ailab_hack`
3. Verify DATABASE_URL in `.env`

### Nginx Issues

1. Test configuration: `sudo nginx -t`
2. Check error logs: `sudo tail -f /var/log/nginx/ailab.seydulla.com.error.log`
3. Verify upstream: `curl http://localhost:3000/health`

### SSL Certificate Issues

1. Check certificate: `sudo certbot certificates`
2. Test renewal: `sudo certbot renew --dry-run`
3. Manually renew if needed: `sudo certbot renew`

## Backup Recommendations

### Database Backup

```bash
docker exec ailab_hack_postgres pg_dump -U postgres ailab_hack > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker exec -i ailab_hack_postgres psql -U postgres ailab_hack < backup_YYYYMMDD.sql
```

## Security Notes

1. Change default PostgreSQL and Redis passwords in production
2. Keep `.env` file secure and never commit it to git
3. Regularly update system packages: `sudo apt update && sudo apt upgrade`
4. Monitor PM2 logs for errors
5. Set up log rotation for PM2 logs
6. Consider setting up firewall rules to restrict database access

## Maintenance

### Update Application

```bash
./scripts/deploy.sh
```

### Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Update Docker Images

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Rotate PM2 Logs

PM2 logs can be rotated using:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```
