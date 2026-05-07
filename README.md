# Professional Chess Assistant

A professional-grade chess analysis tool with advanced engine capabilities, responsive design, and offline support.

## Features

✨ **Core Features**
- Real-time chess engine analysis with configurable depth
- Full game history tracking with PGN/FEN import/export
- Intuitive move input (algebraic notation, visual builder, voice input)
- Board orientation control
- Opening identification
- Captured piece display
- Material advantage display

📱 **Mobile & Accessibility**
- Fully responsive design (mobile, tablet, desktop)
- Touch-optimized controls
- ARIA labels and semantic HTML for screen readers
- Keyboard navigation support (Ctrl+Z, Ctrl+N, Ctrl+F, etc.)
- High contrast color scheme (WCAG AA compliant)
- PWA support with offline capabilities

🚀 **Production Ready**
- Service worker for offline mode
- Web app manifest for installation
- Optimized bundle size
- Error boundary with graceful fallbacks
- Comprehensive error handling

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Building

```bash
npm run build
```

Generates optimized single-file build in `dist/index.html`

### Type Checking

```bash
npm run type-check
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] Update version in `package.json`
- [ ] Review all changes in `git log`
- [ ] Run `npm run build` and verify output
- [ ] Test service worker in DevTools (Application > Service Workers)
- [ ] Test offline mode (DevTools > Offline)
- [ ] Test PWA install prompt
- [ ] Verify on mobile device
- [ ] Test keyboard shortcuts
- [ ] Check bundle size
- [ ] Run type checking: `npm run type-check`

### Server Configuration

#### HTTP Headers

Set these headers for optimal security and performance:

```
# Content Security Policy
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; font-src 'self'; connect-src 'self'

# Security Headers
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin

# Performance
Cache-Control: public, max-age=3600, s-maxage=86400
Vary: Accept-Encoding
```

#### MIME Types

```
.js    -> application/javascript; charset=utf-8
.css   -> text/css; charset=utf-8
.html  -> text/html; charset=utf-8
.json  -> application/json
.woff2 -> font/woff2
```

#### Gzip Compression

Enable gzip compression for:
- `.html` files
- `.js` files
- `.css` files
- `.json` files
- `.svg` files

### Service Worker Caching Strategy

The service worker uses a **cache-first** strategy:
1. Serves from cache if available
2. Falls back to network request
3. Caches successful responses for future use
4. Provides offline fallback page

This ensures the app works completely offline after first visit.

### Deployment Platforms

#### Vercel
```bash
npx vercel deploy --prod
```

#### Netlify
```bash
npm run build
# Drag dist/ folder to Netlify
```

#### GitHub Pages
1. Set `homepage` in package.json: `"homepage": "https://username.github.io/repo"`
2. Build and deploy to gh-pages branch

#### Docker
```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables

Create `.env.production` for production builds:

```env
VITE_APP_TITLE=Chess Assistant
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=true
```

### Monitoring & Analytics

Add analytics to track usage:

```typescript
// src/utils/analytics.ts
export const trackEvent = (event: string, data?: Record<string, any>) => {
  if (!import.meta.env.VITE_ENABLE_ANALYTICS) return;
  // Implement your analytics service (GA4, Mixpanel, etc.)
  console.log('Event:', event, data);
};
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Performance Metrics

Target metrics:
- First Contentful Paint (FCP): < 1.5s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1
- Time to Interactive (TTI): < 3.5s
- Bundle Size: < 500KB (gzipped < 150KB)

Run lighthouse audit:
```bash
npm run build
# Open dist/index.html in Chrome
# Right-click > Inspect > Lighthouse
```

## Troubleshooting

### Service Worker Not Working
1. Check DevTools: Application > Service Workers
2. Verify HTTPS (required for production)
3. Check browser console for errors
4. Try Unregister > Hard refresh

### Mobile Issues
1. Test in Chrome DevTools responsive mode
2. Check touch event handlers
3. Verify viewport meta tag
4. Test on actual device

### Performance Issues
1. Check Network tab for large assets
2. Profile with Lighthouse
3. Use Chrome DevTools Performance tab
4. Check for memory leaks in DevTools

## Support

For issues and feature requests, please open an issue on GitHub.

## License

MIT License - See LICENSE file for details

## Changelog

### v1.0.0 (Initial Release)
- Full chess engine analysis
- Responsive mobile design
- PWA support
- Offline capabilities
- Accessibility improvements
- Production-ready deployment
