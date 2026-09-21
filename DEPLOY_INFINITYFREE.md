# ScrubMark - GitHub & InfinityFree Deployment Guide

This guide walks you through deploying **ScrubMark** to **InfinityFree** hosting from your GitHub repository.

---

## ⚡ Important InfinityFree Architecture Note

**InfinityFree is a standard LAMP stack (Linux + Apache + PHP 8.x + MySQL).**
InfinityFree does **not** support Node.js daemons, Express servers, or Docker containers. 

To ensure ScrubMark works 100% out-of-the-box on InfinityFree, this repository includes a dedicated, production-ready PHP/MySQL bundle inside the **`/infinityfree`** directory:
- `database.sql` – Complete MySQL database tables (`users`, `videos`, `comments`)
- `config.php` – Database connection (PDO) and session configuration
- `api.php` – Full backend REST API (User Register, Login with `password_hash`, YouTube video ingestion, timestamp notes, and owner authorization)
- `index.html` – Full modern frontend with YouTube IFrame API, live timestamp sync, scrub-to-comment, and resolution states
- `.htaccess` – Apache rewrite and security headers

---

## 🚀 Step-by-Step InfinityFree Deployment

### Step 1: Create a MySQL Database on InfinityFree
1. Log in to your **InfinityFree Client Area** and open your hosting account.
2. Click **Control Panel** (vPanel).
3. Under the **Databases** section, click **MySQL Databases**.
4. In the "Create a New Database" field, enter `scrubmark` and click **Create Database**.
5. Take note of the connection details shown on that page:
   - **MySQL Hostname**: (e.g., `sql105.infinityfree.com` or `sql200.epizy.com`)
   - **MySQL Database Name**: (e.g., `epiz_12345678_scrubmark`)
   - **MySQL Username**: (e.g., `epiz_12345678`)
   - **MySQL Password**: (Your InfinityFree vPanel account password)

---

### Step 2: Import `database.sql` via phpMyAdmin
1. In your InfinityFree vPanel, under **Databases**, click **phpMyAdmin**.
2. Click **Connect** next to your newly created database.
3. In phpMyAdmin, click the **Import** tab at the top.
4. Click **Choose File** and select `infinityfree/database.sql` from this repository.
5. Click **Go** at the bottom. You will see green checkmarks confirming that the `users`, `videos`, and `comments` tables were created.

---

### Step 3: Configure Database Credentials in `config.php`
Open `infinityfree/config.php` in your code editor and update lines 15–18 with your details from Step 1:

```php
define('DB_HOST', 'sql105.infinityfree.com');     // Replace with your MySQL Hostname
define('DB_NAME', 'epiz_12345678_scrubmark');     // Replace with your full DB Name
define('DB_USER', 'epiz_12345678');              // Replace with your MySQL Username
define('DB_PASS', 'YOUR_INFINITYFREE_PASSWORD'); // Replace with your vPanel Password
```

---

### Step 4: Upload Files to InfinityFree `htdocs`
You can upload either using the **InfinityFree Online File Manager** or via **FTP (FileZilla)**:

1. In your InfinityFree account, open the **Online File Manager** (or connect with FileZilla using your FTP credentials).
2. Navigate to your website's **`htdocs/`** directory.
3. Upload the contents of the **`/infinityfree`** folder directly into `htdocs/`:
   - `index.html`
   - `api.php`
   - `config.php`
   - `.htaccess`
*(Make sure `index.html` is directly inside `htdocs/`, not inside a nested subfolder).*

4. Visit your InfinityFree domain (e.g. `https://your-subdomain.infinityfreeapp.com`) in your browser.
5. You will see the **ScrubMark** Sign In / Sign Up landing page live!

---

## 🐙 Optional: Automated GitHub Actions FTP Deployment

If you want your GitHub repo to automatically deploy to InfinityFree every time you push to GitHub, add a GitHub Actions workflow:

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to InfinityFree

on:
  push:
    branches:
      - main

jobs:
  web-deploy:
    name: Deploy to InfinityFree FTP
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Sync infinityfree/ to htdocs
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.FTP_SERVER }}     # e.g. ftpupload.net
          username: ${{ secrets.FTP_USERNAME }} # e.g. epiz_12345678
          password: ${{ secrets.FTP_PASSWORD }} # your vPanel password
          local-dir: ./infinityfree/
          server-dir: ./htdocs/
```

Add `FTP_SERVER`, `FTP_USERNAME`, and `FTP_PASSWORD` to your **GitHub Repository Settings -> Secrets and variables -> Actions**.

---

## 🛠️ Summary of Environments

| Feature | In this AI Studio Container | On InfinityFree (Production) |
|---|---|---|
| **Runtime** | Node.js + Express (`server.ts`) | Apache + PHP 8.x (`api.php`) |
| **Database** | File-backed JSON store | MySQL database (`database.sql`) |
| **Auth** | Sign Up & Sign In with PBKDF2 hash | Sign Up & Sign In with `password_hash()` |
| **Frontend** | React 19 + Tailwind + Vite | Vanilla JS + Tailwind CDN (`index.html`) |
