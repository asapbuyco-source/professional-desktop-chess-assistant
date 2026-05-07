# Production Ready Checklist

Quick reference for deploying to production.

## ✅ Pre-Deployment (30 minutes)

```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Type check
npm run type-check

# 3. Build
npm run build

# 4. Verify size
ls -lh dist/index.html  # Should be < 500KB

# 5. Security audit
npm audit
```

## ✅ Testing (15 minutes)

- [ ] Test on desktop (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile (iPhone and Android)
- [ ] Test keyboard shortcuts:
  - [ ] Ctrl+Z (Undo)
  - [ ] Ctrl+Shift+Z (Redo)
  - [ ] Ctrl+N (New Game)
  - [ ] Ctrl+F (Flip Board)
- [ ] Test offline mode (DevTools > Offline)
- [ ] Check console for errors (F12)
- [ ] Run Lighthouse audit

## ✅ Configuration (10 minutes)

### Update Files
- [ ] `package.json`: Update version to 1.0.0
- [ ] `.env.production`: Set `VITE_APP_ENV=production`
- [ ] `CHANGELOG.md`: Document changes
- [ ] `README.md`: Update if needed

### Choose Deployment Platform

**Easy (Recommended for most):**
- [ ] Vercel: `npm i -g vercel && vercel deploy --prod`
- [ ] Netlify: `netlify deploy --prod --dir=dist`

**Self-Hosted:**
- [ ] Docker: `docker build -t chess-assistant:1.0.0 .`
- [ ] Nginx: Use provided `nginx.conf`
- [ ] Apache: Use provided `.htaccess` (in README)

## ✅ Post-Deployment (10 minutes)

```bash
# 1. Verify HTTPS
curl -I https://yourdomain.com
# Should show 200 OK

# 2. Check headers
curl -I https://yourdomain.com | grep Content-Security-Policy

# 3. Test compression
curl -I -H "Accept-Encoding: gzip" https://yourdomain.com
# Should show Content-Encoding: gzip

# 4. Verify service worker
# Open DevTools > Application > Service Workers
# Status should be "running"
```

## ✅ Monitoring (Ongoing)

- [ ] Set up error tracking (Sentry/DataDog)
- [ ] Set up analytics (Google Analytics)
- [ ] Monitor uptime
- [ ] Check logs daily first week
- [ ] Monitor performance metrics

## 🔐 Security Checklist

- [ ] HTTPS enabled
- [ ] CSP headers set
- [ ] CORS properly configured
- [ ] No hardcoded credentials
- [ ] Dependencies up to date
- [ ] Vulnerability scans passed

## 📱 Mobile Ready

- [ ] Responsive at 320px width
- [ ] Touch targets > 44px
- [ ] No horizontal scrolling
- [ ] PWA install works
- [ ] Offline mode works

## ♿ Accessibility

- [ ] Screen reader compatible
- [ ] Keyboard navigation works
- [ ] Contrast ratio WCAG AA
- [ ] No flashing content
- [ ] Aria labels present

## Performance

- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s
- [ ] Bundle size < 500KB
- [ ] Gzipped < 150KB

## Deployment Commands Reference

### Vercel
```bash
npm i -g vercel
vercel deploy --prod
vercel rollback  # If needed
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
netlify open:admin  # View dashboard
```

### Docker (Local/VPS)
```bash
docker build -t chess-assistant:1.0.0 .
docker run -d -p 80:80 -p 443:443 chess-assistant:1.0.0
docker-compose up -d  # With Caddy
```

### GitHub Pages
```bash
npm install --save-dev gh-pages
# Add to package.json: "homepage": "https://username.github.io/chess"
# Add script: "deploy": "gh-pages -d dist"
npm run deploy
```

## Rollback Commands

### Vercel
```bash
vercel rollback
```

### Netlify
```bash
netlify deploy --prod --dir=dist --message="Rollback"
```

### Docker
```bash
docker run -d -p 80:80 chess-assistant:0.9.0  # Previous version
```

## Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Service worker not working | Enable HTTPS, clear cache, check DevTools |
| Slow loading | Check bundle size, enable gzip, use CDN |
| Mobile layout broken | Test responsive mode, check viewport meta |
| PWA not installing | Check manifest.json, ensure service worker running |
| Offline not working | Visit online first, check cache, test offline toggle |
| CSP errors | Update CSP header, check console for blocked resources |

## Version Release Workflow

```bash
# 1. Update version
# Edit: package.json, CHANGELOG.md, .env.production

# 2. Build & test
npm install
npm run build
npm run type-check

# 3. Commit
git add .
git commit -m "Release v1.0.0"

# 4. Tag
git tag -a v1.0.0 -m "Release v1.0.0"

# 5. Push
git push && git push --tags

# 6. Deploy
vercel deploy --prod  # or your platform
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `vite.config.ts` | Build configuration |
| `index.html` | Meta tags and manifest |
| `public/manifest.json` | PWA configuration |
| `public/sw.js` | Service worker |
| `nginx.conf` | Server configuration |
| `Dockerfile` | Container setup |
| `DEPLOYMENT.md` | Detailed deployment guide |
| `TESTING.md` | Testing procedures |
| `CHANGELOG.md` | Version history |

## Support Resources

- 📚 [Deployment Guide](./DEPLOYMENT.md)
- 🧪 [Testing Guide](./TESTING.md)
- 📋 [Audit Report](./AUDIT_REPORT.md)
- 📖 [README](./README.md)
- 🐛 [GitHub Issues](https://github.com/yourusername/chess-assistant/issues)

---

**Estimated Total Time:** 1 hour

**Status:** ✅ Ready for Production

**Last Updated:** January 2024
