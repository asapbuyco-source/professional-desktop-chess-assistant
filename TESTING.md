# Testing Guide

Comprehensive testing procedures for the Chess Assistant application.

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome 90+ (Windows, Mac, Linux)
- [ ] Firefox 88+ (Windows, Mac, Linux)
- [ ] Safari 14+ (Mac)
- [ ] Edge 90+ (Windows)
- [ ] Opera 76+

### Mobile Browsers
- [ ] Chrome Mobile (Android 8+)
- [ ] Firefox Mobile (Android 8+)
- [ ] Safari (iOS 14+)
- [ ] Samsung Internet (Android 9+)

## Device Testing

### Screen Sizes
- [ ] Desktop (1920x1080, 1366x768)
- [ ] Laptop (1280x720)
- [ ] Tablet (768x1024)
- [ ] Large Phone (414x896)
- [ ] Small Phone (375x667)
- [ ] Very Small (320x480)

## Functional Testing

### Game Features
- [ ] Start new game
- [ ] Make moves using keyboard input
- [ ] Make moves using visual builder
- [ ] Make moves by dragging pieces
- [ ] Capture pieces
- [ ] Promotion selection
- [ ] Castling (kingside & queenside)
- [ ] En passant
- [ ] Check detection
- [ ] Checkmate detection
- [ ] Stalemate detection
- [ ] Draw detection (50-move, repetition, insufficient)

### Move Input Methods
- [ ] Algebraic notation (e.g., "e4")
- [ ] Piece + destination (e.g., "Nf3")
- [ ] Full notation (e.g., "Ke2e4")
- [ ] Visual builder (piece + file + rank)
- [ ] Voice input (if enabled)
- [ ] PGN import
- [ ] FEN import

### Board Controls
- [ ] Flip board (Ctrl+F)
- [ ] Undo move (Ctrl+Z)
- [ ] Redo move (Ctrl+Shift+Z)
- [ ] New game (Ctrl+N)
- [ ] Show legal moves
- [ ] Show capture indicators
- [ ] Show check indicator

### Analysis Features
- [ ] Engine analysis updates after moves
- [ ] Depth adjustment works
- [ ] Best move display
- [ ] Evaluation display
- [ ] Mate detection
- [ ] Move suggestions

### Game History
- [ ] Moves displayed in PGN notation
- [ ] Opening identification correct
- [ ] Captured pieces display
- [ ] Material advantage calculation
- [ ] History scrolls on small screens

### Import/Export
- [ ] Copy PGN to clipboard
- [ ] Copy FEN to clipboard
- [ ] Import PGN (simple game)
- [ ] Import PGN (complex game with comments)
- [ ] Import FEN position
- [ ] Error handling for invalid PGN
- [ ] Error handling for invalid FEN

### Settings
- [ ] Engine depth 1-4 works
- [ ] Show arrows toggle
- [ ] Show legal moves toggle
- [ ] Sound toggle
- [ ] Voice toggle
- [ ] Settings persist on reload

## Accessibility Testing

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Shift+Tab reverse navigation
- [ ] Enter to activate buttons
- [ ] Escape to close modals
- [ ] Spacebar to toggle switches
- [ ] Arrow keys for input selection

### Screen Reader (NVDA/JAWS)
- [ ] Page title announced
- [ ] Main content landmarks
- [ ] Form labels announced
- [ ] Button purposes announced
- [ ] Modal dialogs announced
- [ ] Error messages announced
- [ ] ARIA attributes working

### Visual Accessibility
- [ ] High contrast sufficient (WCAG AA)
- [ ] Focus indicators visible
- [ ] No color-only information
- [ ] Text readable at 200% zoom
- [ ] No auto-playing content
- [ ] Animations can be disabled

### Motor Accessibility
- [ ] Touch targets > 44px
- [ ] No time-sensitive content
- [ ] Keyboard-accessible alternatives
- [ ] No hover-only content
- [ ] Gesture alternatives available

## Performance Testing

### Loading Performance
```bash
# Lighthouse audit
npm run build
# Open in Chrome > DevTools > Lighthouse

# Expected scores:
# - Performance: > 90
# - Accessibility: > 95
# - Best Practices: > 90
# - SEO: > 90
```

### Runtime Performance
- [ ] No lag when moving pieces
- [ ] Engine analysis doesn't freeze UI
- [ ] Smooth animations
- [ ] No memory leaks (check DevTools Memory tab)
- [ ] Responsive to input < 100ms

### Bundle Analysis
```bash
npm run build
# Analyze dist/index.html size
# Should be < 500KB uncompressed
# Should be < 150KB gzipped
```

## Mobile Optimization

### Responsive Design
- [ ] Layout adapts to all screen sizes
- [ ] No horizontal scrolling
- [ ] Text readable without zoom
- [ ] Buttons appropriately sized
- [ ] Modals fit on screen
- [ ] Panels collapsible on mobile

### Touch Interaction
- [ ] Drag and drop works
- [ ] Long press works (if used)
- [ ] Swipe works (if used)
- [ ] No "sticky" hover states
- [ ] Touch feedback visible

### Mobile Features
- [ ] PWA install prompt works
- [ ] App can be added to home screen
- [ ] App works offline
- [ ] Status bar visible on iOS
- [ ] Full screen mode available

## PWA Testing

### Installation
- [ ] Install prompt appears (Chrome > add to home screen)
- [ ] App installs successfully
- [ ] App icon displays
- [ ] App name displayed correctly
- [ ] Launch from home screen works

### Offline Functionality
1. Go online and use app (cache population)
2. Toggle offline mode (DevTools > Network > Offline)
3. [ ] App still loads
4. [ ] Previous games still accessible
5. [ ] Board still functional
6. [ ] Move history preserved
7. [ ] Refresh works offline

### Service Worker
- [ ] Registered successfully (DevTools > Application > Service Workers)
- [ ] Updated when app is updated
- [ ] Caching strategy working
- [ ] No console errors
- [ ] Unregister/re-register works

## Security Testing

### Content Security Policy
- [ ] CSP header present
- [ ] No CSP violations in console
- [ ] Scripts only from trusted sources
- [ ] Styles only from trusted sources

### Data Protection
- [ ] No sensitive data in localStorage (check DevTools)
- [ ] No credentials in bundle
- [ ] No personal information logged

### HTTPS
- [ ] Connection is secure
- [ ] Certificate valid
- [ ] No mixed content warnings
- [ ] Redirect from HTTP to HTTPS works

## Browser DevTools Checks

### Console
```javascript
// Run in browser console
// Should show no errors or warnings

// Check for unused styles
performance.measureUserAgentSpecificMemory()

// Check for memory leaks
console.memory
```

### Network Tab
- [ ] No failed requests (404, 500, etc.)
- [ ] No overly large assets
- [ ] Gzip compression enabled
- [ ] Caching headers set
- [ ] Service worker request visible

### Performance Tab
- [ ] No long tasks (> 50ms)
- [ ] Smooth 60fps animations
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3.5s

### Memory Tab
- [ ] No memory leaks on extended use
- [ ] Detached DOM nodes < 100
- [ ] Reasonable heap size
- [ ] Heap doesn't grow unbounded

## Error Handling

### User Errors
- [ ] Invalid move rejected with message
- [ ] Invalid PGN shows clear error
- [ ] Invalid FEN shows clear error
- [ ] Empty input handled gracefully
- [ ] Duplicate moves prevented

### Application Errors
- [ ] Error boundary catches crashes
- [ ] User sees error message
- [ ] Can refresh and recover
- [ ] Errors logged to console
- [ ] No white screen of death

## Edge Cases

### Game States
- [ ] Stalemate position handled
- [ ] Checkmate position handled
- [ ] Threefold repetition detected
- [ ] Fifty-move rule applied
- [ ] Insufficient material detected

### Input Edge Cases
- [ ] Empty PGN import
- [ ] Very long PGN import
- [ ] PGN with comments/variations
- [ ] Ambiguous notation handled
- [ ] Promotion without specifier

### UI Edge Cases
- [ ] Very long game history (> 100 moves)
- [ ] Rapid move sequences
- [ ] Undo/redo edge cases
- [ ] Multiple modals open (shouldn't happen)
- [ ] App backgrounded/resumed

## Regression Testing Checklist

After each update, verify:
- [ ] All tests pass
- [ ] Keyboard shortcuts work
- [ ] Mobile layout correct
- [ ] No console errors
- [ ] Service worker updates
- [ ] No performance regression
- [ ] Accessibility maintained

## Manual Testing Script

Complete this in order:
1. Start new game
2. Make 5 moves using keyboard input
3. Make 2 moves using visual builder
4. Undo 2 moves
5. Flip board
6. Check engine analysis updates
7. Export PGN and copy to clipboard
8. Import the exported PGN
9. Open settings and change engine depth
10. Test on mobile device (responsive design)
11. Test offline mode
12. Test voice input (if available)
13. Test error boundary (inspect error.tsx)
14. Check all keyboard shortcuts work
15. Verify no console errors

## Automated Testing (Future)

Consider adding:
- Unit tests (Jest + React Testing Library)
- E2E tests (Playwright/Cypress)
- Visual regression tests (Percy)
- Performance tests (Lighthouse CI)
- Accessibility tests (axe)

## Test Results Template

```markdown
# Test Results - [Date]

## Environment
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari]
- Version: [1.0.0]

## Passed Tests
- [x] Feature X
- [x] Feature Y

## Failed Tests
- [ ] Feature Z (reason)

## Issues Found
- [Issue ID]: [Description]

## Performance
- FCP: [time]ms
- LCP: [time]ms
- TTI: [time]ms

## Accessibility Score
- Lighthouse: [score]/100

## Tester Name
[Name]

## Sign Off
Approved for production: [Yes/No]
```
