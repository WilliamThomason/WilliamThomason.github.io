# WTE Online — Deployment Guide
# William Thomason English + PayFast Integration

## What This Is

A complete online platform for WTE with:
- Personal join links with pre-applied discount coupons
- PayFast payment processing (ZAR/ZA friendly)
- Student registration & payment tracking
- Admin panel for coupon management
- Video call system (separate page)

## Project Structure

```
wte-online/
├── server.js              ← Main Node.js server
├── package.json           ← Dependencies
├── public/
│   ├── join.html          ← Student join/signup page
│   └── thank-you.html     ← Post-payment confirmation
├── admin/
│   └── coupons.html       ← Admin panel (coupons, students, payments)
└── data/
    ├── coupons.json       ← Coupon database (auto-created)
    ├── students.json      ← Student database (auto-created)
    └── payments.json      ← Payment database (auto-created)
```

## Prerequisites

1. **Server**: Oracle Cloud Free Tier (or any VPS with Node.js)
2. **Domain**: Registered domain name (e.g. williamthomasonenglish.com)
3. **PayFast Account**: Merchant account at payfast.co.za
4. **Node.js**: Version 18 or higher

## Step-by-Step Deployment

### 1. Set Up Oracle Cloud Free Tier

1. Go to https://cloud.oracle.com/free
2. Sign up (credit card required but free tier is truly free)
3. Create an "Always Free" VM:
   - Image: Ubuntu 22.04
   - Shape: VM.Standard.E2.1.Micro (1 OCPU, 1 GB RAM)
   - SSH key pair: Generate and download
4. Note your VM's public IP address

### 2. Configure DNS

At your domain registrar (Namecheap, Cloudflare, etc.):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_SERVER_IP | 600 |
| A | www | YOUR_SERVER_IP | 600 |
| A | admin | YOUR_SERVER_IP | 600 |

### 3. Connect to Your Server

```bash
# From your local terminal (WSL)
chmod 600 ~/Downloads/your_ssh_key.key
ssh -i ~/Downloads/your_ssh_key.key ubuntu@YOUR_SERVER_IP
```

### 4. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.lts | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
node --version  # Should show v20.x.x
```

### 5. Deploy the App

```bash
# Create app directory
sudo mkdir -p /var/www/wte-online
sudo chown ubuntu:ubuntu /var/www/wte-online

# From your local machine, copy the project
scp -i ~/Downloads/your_ssh.key -r /home/irieb/William\'s\ Projects/William\ Thomason\ English/wte-online/* ubuntu@YOUR_SERVER_IP:/var/www/wte-online/

# On the server
cd /var/www/wte-online
npm install

# Create data directory
mkdir -p data
```

### 6. Configure Environment Variables

```bash
cd /var/www/wte-online
nano .env
```

Add this content (replace with YOUR actual credentials):

```
PAYFAST_MERCHANT_ID=YOUR_MERCHANT_ID
PAYFAST_MERCHANT_KEY=YOUR_MERCHANT_KEY
PAYFAST_PASSPHRASE=YOUR_PASSPHRASE
PAYFAST_BASE_URL=https://sandbox.payfast.co.za/eng/process
ADMIN_PASSWORD=your-secure-admin-password-here
PORT=3000
```

**To get PayFast credentials:**
1. Sign up at https://www.payfast.co.za/
2. Go to Settings → Integration
3. Note your Merchant ID and Merchant Key
4. Set a Passphrase (you create this yourself)
5. For testing, use sandbox mode first

### 7. Set Up PM2 (Process Manager)

```bash
sudo npm install -g pm2
cd /var/www/wte-online
pm2 start server.js --name wte-online
pm2 save
pm2 startup
# Run the command PM2 outputs (sudo env PATH=...)
```

### 8. Set Up Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/wte
```

Add:
```
server {
    listen 80;
    server_name williamthomasonenglish.com www.williamthomasonenglish.com;

    # Serve admin panel
    location /admin {
        alias /var/www/wte-online/admin;
        try_files $uri $uri/ /admin/coupons.html;
    }

    # API and dynamic routes → Node.js
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
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/wte /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Set Up SSL (HTTPS — Required by PayFast)

```bash
sudo certbot --nginx -d williamthomasonenglish.com -d www.williamthomasonenglish.com
# Follow prompts (enter email, agree to terms)
# Choose option 2: redirect HTTP → HTTPS
```

Auto-renewal is set up automatically by certbot.

### 10. Test Everything

1. Visit `https://williamthomasonenglish.com/admin/coupons.html`
2. Log in with your admin password
3. Create a test coupon
4. Copy the join link and open it in a new tab
5. Complete a test payment (PayFast sandbox uses test card: 4000 0000 0000 0002)
6. Check that the student appears in the admin panel

### 11. Switch to Live PayFast

When ready for real payments:

1. In your PayFast dashboard, switch from sandbox to live
2. Update the `.env` file:
   ```
   PAYFAST_BASE_URL=https://www.payfast.co.za/eng/process
   ```
3. Restart: `pm2 restart wte-online`

## Usage

### Creating a Coupon for a Student

1. Go to `https://yourdomain.com/admin/coupons.html`
2. Enter admin password
3. Click "Coupons" in sidebar
4. Fill in:
   - **Package name**: e.g. "Beta Student Pack"
   - **Description**: e.g. "4 lessons per month"
   - **Price**: e.g. `18.00`
   - **Original price**: e.g. `21.00` (shows as strikethrough)
   - **Lessons included**: e.g. `1`
   - **Max uses**: e.g. `200` (for 50 weeks at 4x/week)
   - **Expiry date**: e.g. 2026-12-31
5. Click "Create & Generate Link"
6. Copy the link and send it to the student

### Student Flow

1. Student clicks their personal link
2. Sees the package details with their discounted price
3. Enters name, email, phone
4. Clicks "Pay with PayFast"
5. Pays via PayFast (card, EFT, etc.)
6. Lands on thank-you page
7. Their account is registered automatically
8. You see them in the admin panel

## Troubleshooting

### PayFast ITN not working
- Ensure your server is publicly accessible on port 443
- Check `data/payments.json` for ITN logs
- Verify the passphrase matches exactly (case-sensitive)
- Test with PayFast's ITN simulator in dashboard

### SSL certificate issues
```bash
sudo certbot renew --dry-run
sudo certbot certificates
```

### App not starting
```bash
pm2 logs wte-online
# Check for errors
node server.js  # Run directly to see output
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

## Security Notes

- Change the default admin password immediately
- Keep your PayFast credentials in environment variables only (never in code)
- The `.env` file is not committed to git
- HTTPS is mandatory for PayFast
- Backup `data/` directory regularly

## Costs Summary

| Item | Cost |
|------|------|
| Oracle Cloud VM | FREE |
| Domain name | ~USD 10/year |
| SSL certificate | FREE (Let's Encrypt) |
| PayFast fees | 1.95% + ZAR 2.00 per transaction |
| **Total monthly** | **USD 0 + transaction fees** |
