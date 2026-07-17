# PayStreamer Service Deployment Guide

This document provides comprehensive instructions for deploying the PayStreamer backend service on a production server.

## Service Overview

The PayStreamer service is a Node.js/Express/TypeScript backend that:

1. **Sponsored Transactions API** (`POST /sponsor`) - Handles sponsored transactions using the Address Balance gas model
2. **Payment Scheduler** - Automatically processes due payments every 10 seconds by:
   - Discovering registered platforms from `PlatformRegistered` events
   - Finding active subscriptions from `SubscriptionCreated` events
   - Filtering subscriptions where `next_billing_time <= now`
   - Building and executing Payment Transaction Blocks (PTBs)

### Key Components

| File | Description |
|------|-------------|
| `src/index.ts` | Entry point; starts HTTP server and payment scheduler |
| `src/sponsor/routes.ts` | POST /sponsor endpoint for sponsored transactions |
| `src/sponsor/service.ts` | Transaction validation and sponsorship logic |
| `src/scheduler/index.ts` | 10-second interval payment scheduler |
| `src/scheduler/discovery.ts` | Platform and subscription discovery from events |
| `src/scheduler/payment.ts` | Payment PTB construction and execution |
| `src/lib/sui.ts` | Sui SDK client and sponsor keypair management |
| `src/lib/config.ts` | Environment configuration and constants |

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 22.04 LTS (recommended) or similar Linux distribution
- **Node.js**: Version 20 or higher
- **RAM**: Minimum 1GB; recommended 2GB
- **Disk**: Minimum 20GB SSD

### Required Software

- Git
- Node.js 20+
- npm (comes with Node.js)
- Optional: PM2 (recommended for process management) or systemd

### Network Requirements

- **Outbound**: HTTPS (TCP 443) to Sui fullnode
- **Inbound**: HTTP (TCP 3000) for the API (or through Nginx proxy)

---

## Step-by-Step Installation

### 1. Clone the Repository

```bash
# Navigate to the installation directory
cd /opt

# Clone the repository (replace with actual repository URL)
sudo git clone <repository-url> paystreamer

# Navigate to the service directory
cd paystreamer/paystreamer-service
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### 3. Build the Service

```bash
# Compile TypeScript to JavaScript
npm run build
```

After building, the compiled output will be in the `dist/` directory.

### 4. Verify the Build

```bash
# Check that the dist directory was created
ls -la dist/

# Verify the compiled entry point exists
ls -la dist/index.js
```

---

## Configuration

### Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your preferred text editor:

```bash
nano .env
```

### Required Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `SPONSOR_PRIVATE_KEY` | Base64-encoded sponsor private key (Ed25519) | `H3y6...` (64 hex chars as base64) |
| `SPONSOR_ADDRESS` | Sui address of the sponsor | `0x4cdce7c7afad9318fab1cedfc8ff07fb66bea30420443600544282dcb3bc3993` |
| `SUI_RPC_URL` | Sui fullnode RPC URL | `https://fullnode.devnet.sui.io:443` |
| `NETWORK` | Sui network name | `devnet` |
| `PORT` | HTTP server port | `3000` |
| `PACKAGE_ID` | Deployed PayStreamer package ID | `0xf310efaea5adf4bba799c3628563f8c6e0c9677785dca6d7865744e4a3b80afb` |
| `COIN_TYPE_REGISTRY_ID` | Coin type registry object ID | `0x076e62b38cbe903413cb7ee9a177eef0c593a9bac40d0dcdbc7d46315af65639` |
| `PAYMENT_SCHEDULER_ID` | Payment scheduler object ID | `0x09d3b621355da923e9076fa95a8ff253331b44b8a0f4fa61b0ca51878b1d1c4e` |
| `CLOCK_OBJECT_ID` | Sui Clock object ID | `0x0000000000000000000000000000000000000000000000000000000000000006` |

### Sponsor Address Setup

The sponsor address must have sufficient SUI balance on the devnet to pay for gas fees.

1. Get devnet SUI from the faucet:
   ```bash
   curl --location --request POST 'https://faucet.devnet.sui.io/gas' \
   --header 'Content-Type: application/json' \
   --data-raw '{"FixedAmountRequest":{"recipient":"0xYOUR_SPONSOR_ADDRESS"}}'
   ```

2. Verify the balance:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"suix_getBalance","params":["0xYOUR_SPONSOR_ADDRESS","0x2::sui::SUI"]}' \
     https://fullnode.devnet.sui.io:443
   ```

### Private Key Format

The `SPONSOR_PRIVATE_KEY` must be Base64-encoded. If you have a hex private key:

```bash
# Convert hex to base64
echo "YOUR_HEX_PRIVATE_KEY" | xxd -r -p | base64
```

---

## Process Management

Choose one of the following methods to run the service as a background process.

### Option A: PM2 (Recommended)

PM2 is a production-grade process manager with built-in clustering, logging, and auto-restart capabilities.

#### Installation

```bash
# Install PM2 globally
npm install -g pm2
```

#### Start the Service

```bash
# Start the service with PM2
pm2 start dist/index.js --name paystreamer

# Or if using tsx for development
pm2 start npm --name "paystreamer" -- run start
```

#### PM2 Commands

```bash
# Check service status
pm2 status

# View logs
pm2 logs paystreamer

# View real-time logs
pm2 logs paystreamer --lines 100 --follow

# Restart the service
pm2 restart paystreamer

# Stop the service
pm2 stop paystreamer

# Delete from PM2
pm2 delete paystreamer
```

#### Persist PM2 Process List

```bash
# Save the current process list
pm2 save

# Setup PM2 to start on system boot (follow the instructions printed)
pm2 startup
```

#### Cluster Mode (Optional)

For multi-core servers, use cluster mode:

```bash
pm2 start dist/index.js --name paystreamer -i max
```

### Option B: Systemd Service

For servers using systemd, create a service file.

#### Create the Service File

```bash
sudo nano /etc/systemd/system/paystreamer.service
```

Add the following content:

```ini
[Unit]
Description=PayStreamer Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/paystreamer/paystreamer-service
ExecStart=/usr/bin/node /opt/paystreamer/paystreamer-service/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Configure Permissions

```bash
# Create a dedicated user (optional but recommended)
sudo useradd -r -s /usr/sbin/nologin paystreamer

# Set ownership
sudo chown -R paystreamer:paystreamer /opt/paystreamer

# Adjust permissions
sudo chmod -R 750 /opt/paystreamer
```

#### Enable and Start

```bash
# Reload systemd daemon
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable paystreamer

# Start the service
sudo systemctl start paystreamer

# Check status
sudo systemctl status paystreamer
```

#### Systemd Commands

```bash
# View logs
sudo journalctl -u paystreamer -f

# View recent logs
sudo journalctl -u paystreamer --no-pager -n 100

# Restart the service
sudo systemctl restart paystreamer

# Stop the service
sudo systemctl stop paystreamer

# Disable from auto-start
sudo systemctl disable paystreamer
```

---

## Nginx Reverse Proxy (Optional)

Nginx can be used as a reverse proxy to:
- Provide SSL/TLS termination
- Serve the API on port 443 (HTTPS)
- Add additional security headers
- Load balance if running multiple instances

### Installation

```bash
sudo apt update
sudo apt install nginx
```

### Configuration

Create a new Nginx site configuration:

```bash
sudo nano /etc/nginx/sites-available/paystreamer
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS (recommended for production)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy Configuration
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint - no proxy needed
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable the site:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/paystreamer /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL Certificate with Certbot

For automatic SSL certificate management:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain and configure SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure HTTPS and set up renewal
```

Verify auto-renewal:

```bash
# Test the renewal process
sudo certbot renew --dry-run
```

---

## Firewall Configuration

Configure the firewall to allow necessary traffic.

### Using UFW (Uncomplicated Firewall)

```bash
# Allow SSH (important - don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS
ufw allow 443/tcp

# Allow API port (if accessing directly, not through Nginx)
ufw allow 3000/tcp

# Enable the firewall
ufw enable

# Check status
ufw status
```

### Firewall Rules Summary

| Port | Service | Purpose |
|------|---------|---------|
| 22 | SSH | Server administration |
| 80 | HTTP | SSL certificate validation (Certbot) |
| 443 | HTTPS | Secure API access |
| 3000 | Custom | Direct API access (optional, use with Nginx) |

---

## Monitoring and Logs

### Health Check

Verify the service is running correctly:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "network": "devnet",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### PM2 Logs

```bash
# View all logs
pm2 logs paystreamer

# View logs with timestamps
pm2 logs paystreamer --time

# Monitor in real-time
pm2 monit
```

### Systemd Logs

```bash
# View logs with follow
sudo journalctl -u paystreamer -f

# View logs from the last hour
sudo journalctl -u paystreamer --since "1 hour ago"

# View logs with priority
sudo journalctl -u paystreamer -p err
```

### Log Output Format

The service logs in the following format:

```
[Startup] PayStreamer Service starting...
[Startup] Verifying configuration...
[Startup] Sponsor address: 0x4cdce7c7afad9318fab1cedfc8ff07fb66bea30420443600544282dcb3bc3993
[Startup] Connected to Sui network: ...
[Startup] HTTP server listening on port 3000
[Scheduler] Starting payment scheduler (interval: 10000ms)
[HTTP] POST /sponsor
[Sponsor] Processing sponsored transaction for user: 0x...
[Sponsor] Transaction sponsored successfully: ...
```

### Monitoring Metrics to Watch

1. **Sponsor Balance**: Ensure the sponsor address has sufficient SUI for gas fees
2. **Scheduler Cycle Duration**: Long-running cycles may indicate RPC issues
3. **HTTP Response Times**: High latency may indicate RPC congestion
4. **Error Rates**: Monitor for increasing error rates in logs

---

## Troubleshooting

### Service Won't Start

#### Check Configuration

```bash
# Verify .env file exists
ls -la .env

# Check for syntax errors in environment variables
cat .env
```

#### Check Port Availability

```bash
# Check if port 3000 is already in use
sudo lsof -i :3000

# Or
sudo netstat -tlnp | grep 3000
```

#### Check Node.js Version

```bash
node --version  # Should be v20 or higher
```

### RPC Connection Issues

#### Verify Network Connectivity

```bash
# Test RPC endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"rpc.discover"}' \
  https://fullnode.devnet.sui.io:443

# Check DNS resolution
nslookup fullnode.devnet.sui.io
```

#### Common RPC Errors

| Error | Solution |
|-------|----------|
| `ECONNREFUSED` | RPC server is down; check SUI_RPC_URL |
| `ETIMEDOUT` | Network issue; check firewall/proxy |
| `Invalid chain identifier` | Wrong network; verify NETWORK setting |

### Sponsor-Related Issues

#### Insufficient Balance

If transactions fail with gas-related errors:

```bash
# Check sponsor balance
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"suix_getBalance","params":["0xSPONSOR_ADDRESS","0x2::sui::SUI"]}' \
  https://fullnode.devnet.sui.io:443
```

Get more devnet SUI:
```bash
curl --location --request POST 'https://faucet.devnet.sui.io/gas' \
--header 'Content-Type: application/json' \
--data-raw '{"FixedAmountRequest":{"recipient":"0xSPONSOR_ADDRESS"}}'
```

#### Invalid Private Key

Error: `Failed to parse private key` or `Invalid secret key`

Solution: Ensure the private key is correctly Base64-encoded. If you have a hex key:

```bash
# Convert hex to base64
echo "HEX_KEY_HERE" | xxd -r -p | base64
```

### Scheduler Issues

#### Scheduler Not Running

Check if scheduler started:
```bash
# In PM2
pm2 logs paystreamer | grep Scheduler

# In systemd
sudo journalctl -u paystreamer | grep Scheduler
```

#### No Platforms/Payments Found

This is normal if no platforms are registered yet. The scheduler continuously polls for:
1. `PlatformRegistered` events
2. `SubscriptionCreated` events
3. Subscriptions where `next_billing_time <= current_time`

#### Payment Failures

Check logs for specific error messages:

```bash
pm2 logs paystreamer | grep "Payment"
```

Common causes:
- Insufficient sponsor balance
- Invalid object IDs (PACKAGE_ID, PAYMENT_SCHEDULER_ID, etc.)
- Network timeouts

### API Errors

#### POST /sponsor Returns 400

Check the request body format:
```json
{
  "bytes": "<base64 encoded transaction bytes>",
  "userSignature": "<base64 encoded user signature>",
  "userAddress": "0x..."  // Must be 66 chars (0x + 64 hex)
}
```

#### POST /sponsor Returns 500

Check logs for:
- RPC submission errors
- Transaction validation failures
- Sponsor keypair issues

### Performance Issues

#### High Memory Usage

Monitor memory:
```bash
pm2 monit
```

Reduce memory by limiting concurrent operations or upgrading server resources.

#### Slow Response Times

1. Check RPC latency:
   ```bash
   time curl -X POST -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"rpc.discover"}' \
     https://fullnode.devnet.sui.io:443
   ```

2. Consider using a dedicated RPC endpoint (not public faucet)

3. Implement request caching where appropriate

---

## Maintenance

### Updating the Service

1. Stop the service:
   ```bash
   pm2 stop paystreamer
   # or
   sudo systemctl stop paystreamer
   ```

2. Pull latest code:
   ```bash
   cd /opt/paystreamer
   sudo git pull
   ```

3. Rebuild:
   ```bash
   cd paystreamer-service
   npm install
   npm run build
   ```

4. Restart:
   ```bash
   pm2 restart paystreamer
   # or
   sudo systemctl restart paystreamer
   ```

### Backup Configuration

Backup your `.env` file regularly:
```bash
sudo cp /opt/paystreamer/paystreamer-service/.env /path/to/backup/
```

### Log Rotation

#### PM2

PM2 handles log rotation automatically with `pm2-logrotate`:

```bash
# Install log rotate
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Systemd

Create `/etc/logrotate.d/paystreamer`:

```
/opt/paystreamer/paystreamer-service/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload paystreamer > /dev/null 2>&1 || true
    endscript
}
```

---

## Security Considerations

1. **Protect Private Keys**: Store `SPONSOR_PRIVATE_KEY` securely; consider using secrets management
2. **Firewall**: Only expose necessary ports (80, 443, or 3000 if using direct access)
3. **HTTPS**: Always use SSL/TLS in production
4. **Regular Updates**: Keep Node.js and dependencies updated
5. **Monitoring**: Set up alerts for service downtime and error rates
6. **Rate Limiting**: Consider adding rate limiting for the `/sponsor` endpoint

---

## Quick Reference

### Essential Commands

```bash
# Start service
pm2 start dist/index.js --name paystreamer

# Check status
pm2 status

# View logs
pm2 logs paystreamer --lines 100

# Restart
pm2 restart paystreamer

# Health check
curl http://localhost:3000/health
```

### File Locations

| Purpose | Path |
|---------|------|
| Service code | `/opt/paystreamer/paystreamer-service/` |
| Config | `/opt/paystreamer/paystreamer-service/.env` |
| Build output | `/opt/paystreamer/paystreamer-service/dist/` |
| PM2 logs | `~/.pm2/logs/` |
| Systemd logs | `journalctl -u paystreamer` |

---

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify all environment variables are correctly set
3. Ensure the Sui network (devnet/testnet/mainnet) is correct
4. Confirm the sponsor address has sufficient balance

