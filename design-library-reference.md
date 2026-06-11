# Tempo Calendar — Design Library Reference

## Components Discovered & Ready to Use

---

### 🔮 Magic UI — Source Code (Fetched)

#### 1. Bento Grid — for Summary Cards Layout
- **Source**: `apps/www/registry/magicui/bento-grid.tsx`
- **GitHub**: https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/bento-grid.tsx
- **Dependencies**: `@radix-ui/react-icons` (already installed), `@/components/ui/button` (already exists)
- **How to use**: Copy the `BentoGrid` + `BentoCard` components into `src/components/ui/bento-grid.tsx`
- **Tempo use**: Replace the 3-column feature cards on the auth landing page with a BentoGrid. Use for sidebar summary cards (Today, This Week, Streaks, Unscheduled) in a 2x2 grid.
- **Props**: `BentoGrid { children, className }`, `BentoCard { name, background, Icon, description, href, cta }`
- **Design**: Light mode: card with shadow. Dark mode: card with `[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]`. Hover: CTA slides up, background darkens.

#### 2. Animated Theme Toggler — for Light/Dark Mode
- **Source**: `apps/www/registry/magicui/animated-theme-toggler.tsx`
- **GitHub**: https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/animated-theme-toggler.tsx
- **Dependencies**: `lucide-react` (already installed), `react-dom` (built-in), View Transitions API
- **How to use**: Copy into `src/components/ui/animated-theme-toggler.tsx`
- **Tempo use**: Replace the current Sun/Moon button in Header.tsx account menu
- **Props**: `variant` (circle/square/triangle/diamond/hexagon/rectangle/star), `duration`, `fromCenter`, `theme`, `onThemeChange`
- **Design**: Uses View Transitions API for smooth shape-expand animation. Circle variant is default and cleanest for Tempo.

#### 3. Shimmer Button — for Special Actions
- **Source**: `apps/www/registry/magicui/shimmer-button.tsx`
- **GitHub**: https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/shimmer-button.tsx
- **Dependencies**: React only
- **How to use**: Copy into `src/components/ui/shimmer-button.tsx`
- **Tempo use**: Use for the "Schedule All" button, "Recalculate" button, and "Connect Google Calendar" button — any primary CTA.
- **Props**: `shimmerColor`, `shimmerSize`, `shimmerDuration`, `borderRadius`, `background`, `className`
- **Design**: Button with a spinning conic-gradient shimmer highlight that travels around the perimeter

---

### ✨ Aceternity UI — CLI Install (Permission Issue on Windows)

#### 4. Glowing Effect — for Conflict Banner
- **CLI**: `npx shadcn@latest add @aceternity/glowing-effect`
- **Page**: https://ui.aceternity.com/components/glowing-effect
- **Tempo use**: Wrap the conflict banner in a glowing border effect that pulses when conflicts are detected
- **Props**: `blur`, `inactiveZone`, `proximity`, `spread`, `variant` (default/white), `glow`, `borderWidth`

#### 5. Card Hover Effect — for Task Rows
- **CLI**: `npx shadcn@latest add @aceternity/card-hover-effect`
- **Page**: https://ui.aceternity.com/components/card-hover-effect
- **Tempo use**: Apply to task list rows — hover slides the highlight to the hovered row
- **Props**: `items`, `className`

#### 6. Aurora Background — for App Shell
- **CLI**: `npx shadcn@latest add @aceternity/aurora-background`
- **Page**: https://ui.aceternity.com/components/aurora-background
- **Tempo use**: Subtle aurora gradient behind the calendar for a premium feel

---

### 🧲 Componentry — Copy-Paste (Manual)

#### 7. Magnetic Dock — for Calendar Event Hover
- **Page**: https://www.componentry.fun/docs/components/magnetic-dock
- **Tempo use**: Apply to calendar event blocks — events subtly scale up when cursor is nearby
- **Dependencies**: framer-motion (already installed)

#### 8. Dither Gradient — for Header Background
- **Page**: https://www.componentry.fun/docs/components/dither-gradient
- **Tempo use**: Apply to the sticky header for a textured, premium backdrop

---

## Additional Magic UI Components (Available but Not Fetched)

| Component | URL | Tempo Use |
|-----------|-----|-----------|
| Confetti | magicui.design/r/confetti | Task completion celebration effect |
| Animated List | magicui.design/r/animated-list | Staggered task entry animations |
| Neon Gradient Card | magicui.design/r/neon-gradient-card | Hover effect on sidebar summary cards |
| Marquee | magicui.design/r/marquee | Horizontal scrolling for list filter pills |
| Morphing Text | magicui.design/r/morphing-text | Animate the "Tempo Calendar" brand text |
| Blur Fade | magicui.design/r/blur-fade | Used in AnimatedList for staggered animations |
| Number Ticker | magicui.design/r/number-ticker | Animate the unscheduled count, conflict count |
| Scroll Progress | magicui.design/r/scroll-progress | Progress bar for task list scroll |

---

## Integration Plan

### Phase 2 (Calendar Rebuild)
1. Magnetic Dock style hover on calendar events (Componentry style, Framer Motion)
2. Shimmer Button on "Schedule All" (Magic UI)
3. Aurora Background behind calendar (Aceternity)

### Phase 3 (Sidebar + Task Management)
4. Bento Grid for summary cards (Magic UI)
5. Card Hover Effect on task rows (Aceternity)
6. Animated List for task entry/exit (Magic UI)
7. Confetti on task completion (Magic UI)

### Phase 4 (Auto-Scheduling)
8. Glowing Effect on conflict banner (Aceternity)
9. Number Ticker on stat counts (Magic UI)
10. Shimmer Button on "Recalculate" (Magic UI)

### Phase 5 (Settings + Polish)
11. Animated Theme Toggler replacing current toggle (Magic UI)
12. Dither Gradient on header (Componentry)
13. Morphing Text on brand (Magic UI)

---

## Installation Commands (When Permission Issues Resolved)

```bash
# Aceternity components (via shadcn CLI)
npx shadcn@latest add @aceternity/glowing-effect --yes
npx shadcn@latest add @aceternity/card-hover-effect --yes
npx shadcn@latest add @aceternity/aurora-background --yes

# Magic UI components (via shadcn CLI - alternative to manual copy)
npx shadcn@latest add "https://magicui.design/r/bento-grid" --yes
npx shadcn@latest add "https://magicui.design/r/animated-theme-toggler" --yes
npx shadcn@latest add "https://magicui.design/r/shimmer-button" --yes
npx shadcn@latest add "https://magicui.design/r/confetti" --yes
npx shadcn@latest add "https://magicui.design/r/animated-list" --yes
npx shadcn@latest add "https://magicui.design/r/number-ticker" --yes
npx shadcn@latest add "https://magicui.design/r/neon-gradient-card" --yes
npx shadcn@latest add "https://magicui.design/r/morphing-text" --yes
```

---

## ⚠️ Integration Notes (Before Phase 2)

### Hardcoded colors to fix
These components use raw Tailwind colors instead of the project's OKLCH design tokens:
- `neon-gradient-card.tsx`: `bg-gray-100` → `bg-card`, `dark:bg-neutral-900` → `dark:bg-card`
- `number-ticker.tsx`: `text-black dark:text-white` → `text-foreground`
- `bento-grid.tsx`: `text-neutral-700` → `text-card-foreground`, `text-neutral-400` → `text-muted-foreground`

### Theme toggle conflict
`animated-theme-toggler.tsx` manages `.dark` class + localStorage. When replacing the current theme toggle in App.tsx, use its **controlled mode** (`theme` + `onThemeChange` props) and remove the inline `useTheme` hook to avoid race conditions.

### SVG filter ID collision
`morphing-text.tsx` hardcodes `<svg id="filters">`. Only one instance per page. If you need two, replace with `useId()`.

---

## ✅ Installation Status (June 11, 2026)

| Component | Status | File |
|-----------|--------|------|
| Bento Grid | ✅ Installed | `src/components/ui/bento-grid.tsx` |
| Shimmer Button | ✅ Installed | `src/components/ui/shimmer-button.tsx` |
| Morphing Text | ✅ Installed | `src/components/ui/morphing-text.tsx` |
| Animated Theme Toggler | ✅ Installed | `src/components/ui/animated-theme-toggler.tsx` |
| Number Ticker | ✅ Installed | `src/components/ui/number-ticker.tsx` |
| Animated List | ✅ Installed | `src/components/ui/animated-list.tsx` |
| Neon Gradient Card | ✅ Installed | `src/components/ui/neon-gradient-card.tsx` |
| Confetti | ✅ Installed | `src/components/ui/confetti.tsx` |
| Glowing Effect (Aceternity) | ⏳ Pending | CLI permission issue |
| Card Hover Effect (Aceternity) | ⏳ Pending | CLI permission issue |
| Aurora Background (Aceternity) | ⏳ Pending | CLI permission issue |

**New dependencies installed:**
- `framer-motion@12.40.0` (was already installed)
- `canvas-confetti` (was already installed, types added)
- `@radix-ui/react-icons` (new)
- `@types/canvas-confetti` (new, dev)
- `react-dnd` + `react-dnd-html5-backend` (Phase 1 drag-and-drop)

**Infrastructure added:**
- `@/*` path aliases in `tsconfig.app.json` and `vite.config.ts`
- CSS animations: `shimmer-slide`, `spin-around`, `background-position-spin`

---

*Last updated: June 11, 2026. TypeScript + ESLint: ✅ zero errors.*
