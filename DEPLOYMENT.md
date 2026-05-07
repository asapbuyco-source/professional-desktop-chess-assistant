# Production Deployment Guide

This guide covers everything needed to deploy the Chess Assistant application to production.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Build Verification](#build-verification)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Options](#deployment-options)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript type errors resolved: `npm run type-check`
- [ ] No console.error or console.warn in production code
- [ ] All tests passing (if applicable)
- [ ] Code reviewed and approved
- [ ] No hardcoded credentials or API keys

### Performance
- [ ] Run lighthouse: bundle size < 500KB (uncompressed)
- [ ] Service worker generates correctly
- [ ] No unused dependencies
- [ ] Images optimized
- [ ] CSS minified

### Security
- [ ] HTTPS enabled on production domain
- [ ] CSP headers configured
- [ ] No sensitive data in bundle
- [ ] Dependencies audited: `npm audit`
- [ ] Security headers properly set

### Functionality
- [ ] Test all keyboard shortcuts (Ctrl+Z, Ctrl+N, Ctrl+F)
- [ ] Test on mobile device (iOS and Android)
- [ ] Test in multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test offline mode
- [ ] Test PWA install prompt
- [ ] Test voice input (if enabled)
- [ ] Test PGN/FEN import and export
- [ ] Test error boundary (trigger an error)

### Documentation
- [ ] CHANGELOG.md updated
- [ ] README.md up to date
- [ ] Deployment guide reviewed
- [ ] Environment variables documented

## Build Verification

```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Type check
npm run type-check

# Build
npm run build

# Verify output
ls -lh dist/index.html  # Should be < 500KB
```

### Expected Build Output

```
✓ 1234 modules transformed
✓ built in 12.34s
dist/index.html               345 KiB / gzip: 89 KiB
```

## Environment Configuration

### Development
```bash
npm run dev
# .env.development is used automatically
```

### Production Build
```bash
npm run build
# .env.production is used automatically
```

### Environment Variables

**Required for Production:**
```env
VITE_APP_TITLE=Chess Assistant
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=true
```

## Deployment Options

### Option 1: Vercel (Recommended for beginners)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod

# Verify
vercel env list
```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Verify
netlify sites
```

### Option 3: GitHub Pages

```bash
# Update package.json homepage
{
  "homepage": "https://username.github.io/chess-assistant"
}

# Install gh-pages
npm install --save-dev gh-pages

# Add deploy script
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}

# Deploy
npm run deploy
```

### Option 4: Docker (Production VPS)

```bash
# Build image
docker build -t chess-assistant:1.0.0 .

# Run container
docker run -d -p 80:80 -p 443:443 chess-assistant:1.0.0

# Or use docker-compose
docker-compose up -d
```

### Option 5: Traditional Web Server

**For Apache:**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**For Nginx:** Use provided `nginx.conf`

**For IIS:**
```xml
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="React Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchList">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/(api)" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

## Post-Deployment Verification

### Immediate Checks (5 minutes)

```bash
# Check site is loading
curl -I https://yourdomain.com
# Should return 200 OK

# Check CSP headers
curl -I https://yourdomain.com | grep Content-Security-Policy

# Check compression
curl -I -H "Accept-Encoding: gzip" https://yourdomain.com
# Should show Content-Encoding: gzip
```

### Browser Tests

- [ ] Open in Chrome, Firefox, Safari, Edge
- [ ] Check console (F12) for errors
- [ ] Test responsive design (F12 > Toggle device toolbar)
- [ ] Check network tab for slow requests
- [ ] Test all features

### Performance Audit

```bash
# Run Lighthouse
# In Chrome DevTools > Lighthouse > Analyze page load

# Check metrics
# - FCP: First Contentful Paint < 1.5s
# - LCP: Largest Contentful Paint < 2.5s
# - CLS: Cumulative Layout Shift < 0.1
# - TTI: Time to Interactive < 3.5s
```

### Service Worker Verification

1. Open DevTools (F12)
2. Go to Application tab
3. Click Service Workers
4. Verify:
   - Status: "running"
   - No errors in console
   - Cache shows cached files

### Mobile Testing

- [ ] Test on iPhone (Safari)
- [ ] Test on Android (Chrome)
- [ ] Test PWA install prompt
- [ ] Test offline mode (toggle network off)
- [ ] Check touch responsiveness

## Monitoring & Maintenance

### Health Checks

```bash
# Monitor uptime
watch -n 5 'curl -I https://yourdomain.com'

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com
```

### Error Tracking

Add error tracking service:

```typescript
// src/utils/errorTracking.ts
export const reportError = (error: Error, context?: Record<string, any>) => {
  // Send to your error tracking service (Sentry, DataDog, etc.)
  console.error('Reported error:', error, context);
};
```

### Performance Monitoring

Use services like:
- **Google Analytics** - User analytics
- **Sentry** - Error tracking
- **DataDog** - APM and monitoring
- **New Relic** - Full-stack monitoring
- **LogRocket** - Session replay

### Regular Updates

- Update dependencies monthly: `npm update`
- Audit security: `npm audit fix`
- Check for new vulnerabilities
- Update service worker version

## Troubleshooting

### Service Worker Not Registering

**Problem:** Service worker not showing in DevTools

**Solutions:**
1. Check HTTPS is enabled (required for production)
2. Clear browser cache and reload
3. Check console for errors in `/sw.js`
4. Verify `/sw.js` is being served correctly
5. Try unregistering: DevTools > Application > Service Workers > Unregister

### Slow Initial Load

**Problem:** First load takes > 3 seconds

**Solutions:**
1. Check bundle size: `npm run build`
2. Enable gzip compression on server
3. Enable caching headers
4. Use CDN for distribution
5. Check network tab for slow requests

### PWA Install Not Working

**Problem:** Install prompt not appearing

**Solutions:**
1. Check manifest.json is served correctly
2. Verify manifest has required fields
3. Check service worker is running
4. Ensure HTTPS is enabled
5. Wait 5 seconds before expecting prompt (user activity required)

### Offline Not Working

**Problem:** App doesn't work offline

**Solutions:**
1. Visit site online first (cache population)
2. Check service worker is registered
3. Verify files are cached: DevTools > Application > Cache Storage
4. Check Network tab in DevTools (offline mode toggle)
5. Check browser allows service workers

### CORS Errors

**Problem:** Cross-origin resource sharing errors

**Solutions:**
1. Check server CORS headers
2. Verify API endpoint is accessible
3. Use CORS proxy if needed
4. Check browser console for specific errors

### Mobile Layout Issues

**Problem:** Layout broken on mobile

**Solutions:**
1. Test in Chrome DevTools responsive mode
2. Test on actual device
3. Check viewport meta tag in index.html
4. Check CSS media queries
5. Verify touch targets are > 44px

## Version Management

### Semantic Versioning

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (1.x.0): New features
- **PATCH** (1.0.x): Bug fixes

### Updating Version

1. Update `package.json` version
2. Update `CHANGELOG.md`
3. Commit: `git commit -m "Release v1.1.0"`
4. Tag: `git tag -a v1.1.0 -m "Release v1.1.0"`
5. Push: `git push && git push --tags`

## Rollback Procedure

If issues occur after deployment:

```bash
# For Vercel
vercel rollback

# For Netlify
netlify deploy --prod --dir=dist --message="Rollback to previous version"

# For Docker
docker run -d -p 80:80 chess-assistant:1.0.0  # Previous version

# For GitHub Pages
git revert <commit-hash>
git push
npm run deploy
```

## Support & Contact

For issues:
1. Check browser console (F12)
2. Check server logs
3. Review AUDIT_REPORT.md
4. Check GitHub Issues
5. Contact support team

---

**Last Updated:** January 2024
**Version:** 1.0.0
**Maintained by:** Chess Assistant Team
