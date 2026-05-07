# Netlify Deployment Guide for Chess Assistant

## Quick Deploy (2 minutes)

### Option 1: Connect GitHub (Easiest - Automatic deploys)

1. **Push code to GitHub**
   ```bash
   git remote add origin https://github.com/yourusername/chess-assistant.git
   git push -u origin main
   ```

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up/login with GitHub
   - Click "New site from Git"
   - Select your repository
   - Netlify auto-detects `netlify.toml` settings
   - Click "Deploy"

3. **That's it!** 🎉
   - Your site is live at `https://yoursite.netlify.app`
   - Future pushes automatically deploy

### Option 2: CLI Deploy (5 minutes)

```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Login to Netlify
netlify login

# 3. Build locally
npm run build

# 4. Deploy
netlify deploy --prod --dir=dist

# 5. Your app is live! 🎉
```

### Option 3: Drag & Drop (1 minute - Manual)

1. Build: `npm run build`
2. Go to [netlify.com/drop](https://netlify.com/drop)
3. Drag the `dist/` folder
4. Your site is live (random URL)
5. Connect to custom domain in settings

---

## netlify.toml Explained

The `netlify.toml` file I created includes:

### Build Settings
```toml
[build]
  command = "npm install && npm run build"  # Build command
  publish = "dist"                          # Folder to deploy
```

### SPA Routing
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"  # Redirect all routes to index.html
  status = 200
```

### Caching Strategy
```toml
# Static assets - cache forever (1 year)
[[headers]]
  for = "/assets/*"
  Cache-Control = "public, max-age=31536000, immutable"

# HTML - cache 1 hour
[[headers]]
  for = "/*.html"
  Cache-Control = "public, max-age=3600"
```

### Security Headers
```toml
# Content Security Policy
Content-Security-Policy = "default-src 'self'; ..."

# Other security headers
X-Content-Type-Options = "nosniff"
X-Frame-Options = "DENY"
# ... and more
```

---

## After First Deploy

### 1. Add Custom Domain
1. Go to Site Settings → Domain Management
2. Add custom domain
3. Follow DNS setup instructions

### 2. Enable HTTPS
- Automatic! Netlify provides free SSL cert via Let's Encrypt
- Certificate renews automatically

### 3. Setup Build Notifications
1. Go to Notifications
2. Add Slack/Email for deploy events

### 4. Configure Environment Variables
1. Go to Build & Deploy → Environment
2. Add production variables:
   ```
   NODE_ENV = production
   VITE_APP_ENV = production
   ```

### 5. Setup Analytics (Optional)
1. Go to Analytics settings
2. Enable Netlify Analytics for performance tracking

---

## Deployment Scenarios

### Scenario 1: Deploy from GitHub (Recommended)

```bash
# One-time setup
git remote add origin https://github.com/you/chess-assistant.git
git push -u origin main

# Then on Netlify:
# 1. Connect GitHub repo
# 2. Every push automatically deploys
# 3. Uses netlify.toml automatically
```

### Scenario 2: Deploy from Branch

Deploy preview deploys automatically for pull requests:

```bash
# Create a branch
git checkout -b feature/new-chess-analysis

# Make changes and push
git push origin feature/new-chess-analysis

# Preview deploy created automatically
# View at: https://deploy-preview-XX--yoursite.netlify.app
```

### Scenario 3: Manual Build & Deploy

```bash
# Build locally
npm run build

# Deploy via CLI
netlify deploy --prod --dir=dist

# Or drag dist/ folder to netlify.com/drop
```

---

## Troubleshooting

### Build Fails on Netlify

**Problem:** `Command failed: npm run build`

**Solutions:**
```bash
# 1. Check Node version
node --version  # Should be 18+

# 2. Try building locally
npm install
npm run build
npm run type-check

# 3. Check netlify.toml
# Verify command and publish directory

# 4. Check logs
# Go to Netlify → Deploys → [Failed Deploy] → Deploy Log
```

### 404 Errors on Routes

**Problem:** SPA routes (e.g., `/game`, `/analysis`) return 404

**Solution:** Already fixed! `netlify.toml` includes:
```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Service Worker Not Working

**Problem:** Offline mode doesn't work

**Check:**
1. Go to DevTools → Application → Service Workers
2. Status should be "running"
3. Check Cache Storage for cached files
4. Verify HTTPS is enabled
5. Wait 5 seconds for service worker to activate

**Solution:**
```toml
[[headers]]
  for = "/sw.js"
  Service-Worker-Allowed = "/"
  Cache-Control = "public, max-age=86400"
```
Already configured in `netlify.toml`!

### Slow Deploys

**Problem:** Build takes > 5 minutes

**Solutions:**
1. Check Dependencies
   ```bash
   npm ls  # See package tree
   npm prune  # Remove unused
   ```

2. Clear Cache
   - Netlify → Build & Deploy → Clear Build Cache
   - Then trigger new deploy

3. Optimize Build
   ```bash
   npm install --legacy-peer-deps  # If version conflicts
   ```

---

## Deployment Checklist

Before deploying:

```
Before First Deploy:
☐ Code committed to GitHub
☐ netlify.toml in root directory
☐ npm install works locally
☐ npm run build produces dist/
☐ npm run type-check passes
☐ No console errors

After First Deploy:
☐ Site loads at netlify.com URL
☐ PWA install works
☐ Service worker registered
☐ Test keyboard shortcuts
☐ Test offline mode
☐ Lighthouse score > 90

Before Production:
☐ Custom domain added
☐ HTTPS enabled
☐ Build notifications setup
☐ Monitoring/analytics enabled
☐ Team members invited
```

---

## Useful Netlify CLI Commands

```bash
# Login/Logout
netlify login
netlify logout

# Deploy
netlify deploy --prod --dir=dist          # Production
netlify deploy --dir=dist                 # Preview
netlify deploy --prod --dir=dist --message "v1.0.0"  # With message

# Status
netlify status
netlify open:admin                         # Open dashboard
netlify open:site                          # Open live site

# Functions
netlify functions:create                   # Create function
netlify functions:invoke                   # Test function

# Environment
netlify env:list                           # List variables
netlify env:set VAR_NAME value             # Set variable
netlify env:unset VAR_NAME                 # Delete variable

# Build
netlify build                              # Build locally
netlify serve                              # Serve locally
```

---

## Performance Tips

### Optimize Build
```bash
# 1. Check bundle size
npm run build
ls -lh dist/index.html

# 2. Analyze dependencies
npm list --depth=0

# 3. Remove unused packages
npm prune
npm install --only=production
```

### Optimize Deployment
1. **Lazy load images** → Images load on demand
2. **Code splitting** → Already configured in Vite
3. **Minification** → Already enabled
4. **Caching** → netlify.toml configures optimal headers

### Monitor Performance
1. **Netlify Analytics** → Built-in analytics
2. **Lighthouse** → DevTools > Lighthouse tab
3. **WebPageTest** → webpagetest.org

---

## Advanced Configuration

### Custom Build Command
```toml
[build]
  command = "npm run build && npm run test"
```

### Environment-Specific Builds
```toml
[context.production]
  command = "npm install && npm run build"
  environment = { NODE_ENV = "production" }

[context.branch-deploy]
  command = "npm install && npm run build"
  environment = { NODE_ENV = "development" }
```

### Scheduled Functions (Cron Jobs)
```toml
[[functions]]
  name = "cleanup"
  path = "netlify/functions/cleanup"
  events = ["scheduled(0 0 * * *)"]  # Daily at midnight
```

---

## Support & Resources

- 📚 [Netlify Docs](https://docs.netlify.com/)
- 🔧 [netlify.toml Reference](https://docs.netlify.com/configure-builds/file-api-reference/)
- 💬 [Netlify Community](https://community.netlify.com/)
- 🐛 [Report Issues](https://github.com/netlify/netlify-cli/issues)

---

## Next Steps

1. **Push to GitHub** (if not already done)
2. **Connect to Netlify** (via GitHub or CLI)
3. **Watch it deploy!** 🚀
4. **Add custom domain**
5. **Enable analytics**

**You're ready to go! 🎉**

Your Chess Assistant is now production-ready on Netlify!
