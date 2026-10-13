# HPZ DESIGN SYSTEM V2 — UNDERSEA NAVY

## Status
Current visual source of truth for all HPZ customer-facing pages.

Reference baseline:
- original HPZ Aquaroom undersea UI
- deep navy water
- animated fish background
- translucent dark glass cards
- cyan + orange brand accents

V2 supersedes the light palette documented in HPZ DESIGN SYSTEM V1.

## Scope
Applies to:
- Home
- Catalog / fish detail / tank catalog
- Nhật Báo
- HPZWiki
- AquaCare
- HPZMarket
- Community
- My HPZ
- Login / signup / account flows
- Policy
- /ui-kit

Admin remains outside this customer-facing visual refactor.

## Global background
Every customer-facing page must render through `HPZAppShell`.

`HPZAppShell` mounts the shared `LegacyScene` canvas:
- fish sprites
- bubbles
- suspended particles
- god rays
- scroll parallax
- turtle on desktop
- reduced-motion fallback

Do not create per-module background scenes.

## Canonical tokens

```css
--hpz-navy-950: #06121f;
--hpz-navy-900: #081827;
--hpz-navy-800: #0a1f33;

--hpz-surface:   rgba(10,31,51,.72);
--hpz-surface-2: rgba(15,42,66,.85);
--hpz-line:      rgba(64,196,255,.22);

--hpz-text:       #eaf6ff;
--hpz-text-soft:  #c7dfef;
--hpz-text-muted: #8fb6cf;

--hpz-cyan:     #3fd0ff;
--hpz-cyan-2:   #22b8e6;
--hpz-accent:   #ff8a3d;
--hpz-accent-2: #ffb15c;
```

## Brand treatment
- Actual HPZ logo image in the round brand mark.
- Logo ring/accent: orange.
- Brand text: cyan → orange gradient.
- Header: transparent deep navy glass.

## Shared component rules

### Card / KPI
Dark translucent glass only.

Do not use white page cards for customer-facing surfaces.

### Primary button
Cyan → orange gradient.

### Secondary
Dark navy glass with cyan border.

### Ghost
Transparent with cyan text/border.

### Form
Dark input surface, pale text, cyan focus ring.

### Modal
Deep navy opaque/glass overlay.

### Tabs
Navy glass rail; active tab uses cyan → orange gradient.

### Table
Dark rows and navy header.

## Page layout
Business layout from each module remains unchanged unless the feature explicitly requests layout changes.

Visual changes should be implemented at shared-token/component level first.

Module CSS may define:
- AquaCare tank canvas
- product images
- charts
- business-specific visualization

Module CSS must not redefine global page background, base card, button, form, modal or tabs.

## Navigation compatibility
Canonical and legacy public routes remain supported.

Do not remove route discoverability while refactoring the visual shell.

## Accessibility/performance
- `prefers-reduced-motion` must disable/reduce decorative animation.
- Background canvas is decorative and cannot block pointer input.
- Mobile scene uses lower object counts/DPR.
- Content surfaces must keep sufficient contrast over moving background.

## UI Kit
`/ui-kit` is the visual regression reference for V2.

If a shared component does not match V2 in `/ui-kit`, fix the shared component/theme rather than adding a one-off page override.
