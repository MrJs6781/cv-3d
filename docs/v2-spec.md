# CV-3D v2 — Build Spec ("Exploded Interface")

Owner of design/review: lead. Implementers: three parallel agents, each owning **disjoint files**.
Stack: Vite 8 + vanilla JS (ES modules) + three@0.187.0. No other runtime deps. No frameworks.

## 1. Concept

The resume is told as a **browser render pipeline**. The signature 3D object is an
**exploded interface**: 8 rounded translucent UI panels ("layers") stacked in depth, like
Chrome DevTools' 3D Layers view. As the visitor scrolls, the same 8 layers re-arrange into a
new formation per chapter. Everything the 3D shows is *read from the DOM* (single source of truth).

| # | id | Pipeline kicker | Content | 3D formation |
|---|----|----|----|----|
| 0 | `top` | `00 · Boot` | Hero | **Stack** — compact isometric stack, layers "compile in" one by one (reveal sweep) |
| 1 | `about` | `01 · Parse — Profile` | Summary, strengths, education, languages | **Explode** — gap widens, side view: UI layers front, server/data layers back, connector lines visible |
| 2 | `skills` | `02 · Style — Toolkit` | 6 skill groups | **Bento wall** — layers 0–5 tile 3×2 facing camera; hovered skill group's tile pops forward |
| 3 | `experience` | `03 · Layout — Experience` | 5 jobs | **Carousel** — layers 0–4 crossfade to job cards; active job (scroll-synced) is front-centre |
| 4 | `projects` | `04 · Paint — Selected work` | 3 projects | **Fan** — layers 5–7 crossfade to project screens fanned in an arc; hovered project centres |
| 5 | `contact` | `05 · Ship — Contact` | Email, socials, local time | **Ship** — all layers collapse into one tight finished stack, slow turntable |

## 2. Files & ownership

| Agent | Owns (creates/overwrites) | Must NOT touch |
|---|---|---|
| **A — Markup & Styles** | `index.html`, `src/styles/*.css` | `src/scene/**`, `src/ui/**`, `src/main.js` |
| **B — 3D Scene** | `src/scene/*.js` | everything else |
| **C — UI & entry** | `src/main.js`, `src/ui/*.js` | everything else |

Delete nothing outside your files. v1 files (`src/style.css`, old `src/main.js`) get replaced:
A deletes `src/style.css`; C overwrites `src/main.js`.

## 3. DOM contract (A produces it, B & C consume it — names are binding)

```html
<html lang="en" data-theme="dark">       <!-- A: inline head script sets data-theme before paint (see §5) -->
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <canvas id="scene" aria-hidden="true"></canvas>
  <div class="grain" aria-hidden="true"></div>

  <header class="site-nav">               <!-- C adds .is-scrolled after 24px -->
    <a class="brand" href="#top">AJ<span>.</span></a>
    <nav class="nav-links" aria-label="Primary">
      <a href="#about" data-nav="1">Profile</a> … data-nav="2" Skills, "3" Experience, "4" Projects, "5" Contact
    </nav>
    <div class="nav-actions">
      <button id="palette-open" class="kbd-btn" type="button" aria-haspopup="dialog">Search <kbd data-kbd-mod>Ctrl</kbd><kbd>K</kbd></button>
      <button id="theme-toggle" type="button" aria-label="Switch to light theme" aria-pressed="false">(sun+moon svg)</button>
      <button id="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">(2-line svg)</button>
    </div>
    <div class="nav-progress" aria-hidden="true"></div>   <!-- width = var(--progress) -->
  </header>

  <div id="mobile-menu" class="mobile-menu" hidden> links with data-nav + theme row </div>
  <ol class="rail" aria-hidden="true"><li data-nav="0"></li> … <li data-nav="5"></li></ol>

  <main id="main">
    <section id="top" class="chapter hero" data-chapter="0" aria-label="Introduction">
      <div class="chapter-body"> … content … </div>
      <div class="stage" aria-hidden="true"></div>        <!-- empty box the 3D aligns to -->
    </section>
    <section id="about" class="chapter" data-chapter="1" aria-labelledby="about-title"> … same shape … </section>
    … skills (2), experience (3), projects (4), contact (5)
  </main>

  <dialog id="palette" class="palette" aria-label="Command palette"> (input + listbox, built by C — A only styles it) </dialog>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <script type="module" src="/src/main.js"></script>
</body>
```

Data hooks:
- Hero name: `<h1 class="hero-name" data-split>Abolfazl<br>Javadinia</h1>` — C splits characters (see §6).
- Stats: `<span data-count="5" data-suffix="+">5</span>` — C counts up. Real number must be in the markup (no-JS safe).
- Local time: `<time data-clock></time>` and `<span data-clock-diff></span>` — C fills.
- Copy: `<button data-copy="mr.js.programmer@gmail.com">Copy</button>` — C copies + toast.
- Print: `<button data-print>` — C calls `window.print()`.
- Magnetic: class `magnetic` on primary CTAs — C animates (fine pointer only).
- Skill groups: `<article class="skill-group" data-skill="0..5" tabindex="0">` order: Frontend, UI & Styling, State & Data, Backend, Testing & Quality, Tools & Workflow.
- Jobs: `<li class="job" data-job="0..4" data-company="Capital Chain" data-role="Full Stack Developer" data-period="Feb 2026 – Sep 2026" data-place="Remote" data-tech="Next.js · TypeScript · Tailwind CSS · API Routes">` (newest first). C toggles `.is-active`.
- Projects: `<article class="project" data-project="0..2" data-title="…" data-tech="…" tabindex="0">`.
- Footer year: `<span data-year>2026</span>`.

## 4. Events (C dispatches on `document`, B listens)

| Event | detail | When |
|---|---|---|
| `themechange` | `{ theme: 'light' \| 'dark' }` | after `data-theme` changed |
| `jobfocus` | `{ index: 0..4 }` | active job changes (IntersectionObserver, rootMargin `-45% 0px -45% 0px`) |
| `skillfocus` | `{ index: 0..5 \| null }` | pointerenter/focusin on `.skill-group` / leave |
| `projectfocus` | `{ index: 0..2 \| null }` | pointerenter/focusin on `.project` / leave |

B also reads `document.documentElement.dataset.theme` at init. B sets `html.scene-ready` after
first frame, or `html.no-webgl` on failure.

## 5. Theme

`html[data-theme="light"|"dark"]`. Inline head script (A writes it verbatim):
```html
<script>try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){document.documentElement.dataset.theme='dark'}</script>
```
Tokens (A defines on `[data-theme]`; B reads the `--scene-*` ones via getComputedStyle on `html`):

| token | dark | light |
|---|---|---|
| `--bg` | `#07080c` | `#f5f4ef` |
| `--bg-elev` | `rgba(16,18,26,.62)` | `rgba(255,255,255,.72)` |
| `--ink` | `#eceef3` | `#0e1016` |
| `--muted` | `#8a91a3` | `#5a6172` |
| `--line` | `rgba(255,255,255,.08)` | `rgba(14,16,22,.09)` |
| `--accent` | `#7aa2ff` | `#3355f0` |
| `--accent-2` | `#b28cff` | `#7c4dff` |
| `--mint` | `#6ee7d2` | `#0f9f87` |
| `--scene-surface` | `#10131c` | `#ffffff` |
| `--scene-ink` | `#e6e9f2` | `#11141b` |
| `--scene-muted` | `#5d6478` | `#9aa1b1` |
| `--scene-line` | `#2a3042` | `#d9dce4` |
| `--scene-accent` / `-2` / `--scene-mint` | = accent / accent-2 / mint |
| `--scene-blend` | `additive` | `normal` |

Theme switch uses the View Transitions API (C) with a circular clip-path reveal from the toggle
button. A must include:
```css
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
```

## 6. Agent A — Markup & Styles

**Fonts** (Google Fonts, `display=swap`): Geist 400/500/600/700, Geist Mono 400/500, Instrument Serif italic 400.
Headings use Geist; exactly one phrase per h2 is wrapped in `<em>` and rendered in Instrument Serif italic
(e.g. "Frontend-focused, <em>full-stack</em> capable."). Mono for kickers, dates, tech lines, kbd.

**Layout**
- `.chapter`: `min-height: 100svh`. Desktop ≥1024px: 12-col grid inside a centred container
  `max-width: 1440px`, side padding `clamp(20px, 5vw, 72px)` + safe-area insets. `.chapter-body` spans
  cols 1–6 (experience/projects 1–7); `.stage` spans the rest, `position: sticky; top: 0; height: 100svh`,
  `align-self: start`. Long chapters' text scrolls while the stage stays pinned.
- <1024px: single column. Hero `.stage` is a block **above** the hero text, height `clamp(240px, 42svh, 420px)`.
  Other chapters' `.stage` → `display:none` (the scene then goes "ambient" behind the content).
- Must look deliberate at 320, 375, 414, 768, 1024, 1280, 1440, 1920, 2560. No horizontal scroll
  (`overflow-x: clip`). Fluid type with `clamp()`. Use container queries (`container-type: inline-size`)
  for the skills grid, project grid and job cards.

**Visual language**: restrained, editorial, precise. 1px hairlines (`--line`), 14–18px radii, glass cards
(`--bg-elev` + `backdrop-filter: blur(16px) saturate(140%)`, opaque fallback in `@supports not`).
Static grain overlay `.grain` (inline SVG feTurbulence data-URI, `position:fixed; inset:0; pointer-events:none`,
opacity .035 dark / .05 light, `mix-blend-mode: overlay` dark / `multiply` light). Subtle radial accent glow
behind the hero text. Hover states: hairline brightens + 2px lift, 200ms `cubic-bezier(.2,.7,.2,1)`.
Focus: 2px accent outline, offset 3px, everywhere. Selection color = accent.

**Sections content** (verbatim data — do not invent facts):
- Hero: eyebrow pill with pulsing mint dot "Available for remote roles" + " · Neyshabur, Iran · " + `<time data-clock>`.
  `h1.hero-name` (data-split). Role "Senior Frontend Engineer" (gradient text accent→accent-2).
  Stack line mono "React · Next.js · TypeScript". Lede: "I build scalable, high-performance web applications — from
  design systems to SSR platforms and AI-driven dashboards." CTAs: primary "Get in touch" (mailto, .magnetic),
  secondary "View experience" (#experience), tertiary text button opening palette is NOT needed (nav has it).
  Stats (dl): `5+` years frontend · `1` year backend · `5` remote roles. Scroll cue at bottom ("Scroll" + animated 1px line).
- About: h2 "Frontend-focused, <em>full-stack</em> capable." Summary paragraph (resume's Professional Summary, verbatim).
  Strengths list (5, from resume Core Strengths) as numbered rows `01…05` with title + description.
  Sub-block "Education": **B.Sc. Computer Science** · Completed; **B.Sc. Computer Engineering** · Completed
  ("Hakim Sabzevari University, Sabzevar"). Sub-block "Languages": Persian — Native;
  English — Professional working proficiency (strong in technical reading and writing).
- Skills: h2 "The <em>toolkit</em>." 6 `.skill-group` cards (index-numbered, title, chip list). Chips exactly as v1 `index.html`.
- Experience: h2 "Where I've <em>shipped</em>." Timeline `ol.timeline` of 5 `.job` items with data attributes (§3),
  visible content = period, place, role, company (+ sub-line for Digbri "AI Data Analytics Platform",
  Pouyamachine "Technology Development Co."), bullets, tech line. Copy all bullets verbatim from v1 `index.html`.
  Active job (`.is-active`) gets accent node + brighter card. Timeline line has a progress fill using
  `scroll-timeline`/`view-timeline` when supported (`@supports (animation-timeline: view())`), static otherwise.
- Projects: h2 "Selected <em>work</em>." 3 `.project` cards (bento: first full width ≥ container 640px), each:
  index, title, tag (open source on the 3rd), description, tech, link for the 3rd (verbatim from v1).
- Contact: h2 "Let's build something <em>fast</em>." Big email link + copy button (`data-copy`). Socials (LinkedIn, GitHub, X, Medium)
  as rows with arrow that slides on hover. Info row: local time card (`data-clock`, `data-clock-diff`), "Print / Save as PDF" button (`data-print`).
  Footer: "© <span data-year>2026</span> Abolfazl Javadinia · Designed & built with Three.js".
- No phone number anywhere.

**Motion (CSS)**: hero characters `.ch` (spans C creates, each has `--i`) rise+fade with 28ms stagger once `html.is-loaded`;
other chapter content reveals with native `animation-timeline: view()` inside `@supports` + `prefers-reduced-motion: no-preference`
(never on the hero). `prefers-reduced-motion: reduce` disables all animation/transition.

**Nav**: fixed, transparent at top; `.is-scrolled` → glass bar with hairline bottom. Links show active state via
`[aria-current="true"]` (C sets it) with an animated underline. `.nav-progress` 1px bar, `transform: scaleX(var(--progress,0))`.
<768px: hide `.nav-links` and `#palette-open` label text (keep icon), show `#menu-toggle`. `.mobile-menu` = full-screen
sheet below nav, large links, visible when `html.menu-open` (C toggles `hidden` + class).
Rail: fixed right, ≥1280px only, 6 dots; `.on` dot elongates.

**Palette styles**: `dialog.palette` centred, max-width 560px, glass, `::backdrop` blur+dim; C builds inner markup:
`.palette-input` (input), `ul.palette-list[role=listbox]` > `li.palette-item[role=option][aria-selected]` containing
`.palette-label`, `.palette-hint`; group headings `li.palette-group`. Style all of these. Toast: bottom-centre pill, `.toast.is-visible`.

**Print** (`@media print`): clean one-column black-on-white resume, hide canvas/nav/rail/grain/stages/buttons/palette,
show both degrees, avoid breaks inside jobs/cards, `@page { margin: 14mm }`.

**No-WebGL**: `html.no-webgl #scene{display:none}`; stages show a soft gradient instead.

Organise CSS as `src/styles/index.css` that `@import`s: `tokens.css`, `base.css`, `layout.css`, `components.css`,
`sections.css`, `print.css`. `index.html` links `/src/styles/index.css`. Delete old `src/style.css`.
Also include OG/Twitter meta, JSON-LD Person (update `alumniOf`/education is optional), SVG favicon (keep v1's), `theme-color`
per scheme (two meta tags with media).

## 7. Agent B — 3D Scene (`src/scene/`)

Files: `index.js` (exports `init(canvas)`), `layers.js` (panel mesh + shader), `textures.js` (canvas drawings),
`formations.js` (pose functions), `dust.js` (ambient particles), `theme.js` (reads CSS vars). Import only from `'three'`
(named imports, tree-shakeable). No addons unless trivially needed.

**Renderer**: `WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'})`, transparent clear,
`outputColorSpace` SRGB. Camera: Perspective fov 30, z = 14. Pixel ratio `min(devicePixelRatio, 2)`; **adaptive DPR**: average
frame time over 90 frames; if > 20ms drop DPR by 0.25 (floor 1); never raise again in-session. Size from `canvas.clientWidth/Height`.
On failure: `html.no-webgl`, return.

**Layers**: 8 panels, PlaneGeometry 3.2 × 2.0 (16:10), one ShaderMaterial each (transparent, depthWrite false,
DoubleSide, sorted back-to-front by renderOrder each frame). Fragment shader:
- rounded-rect SDF (radius 0.08 in plane units) → antialiased alpha via `fwidth`;
- 1px-ish border ring from the SDF in `uLine` color, brightened toward top-left (fake light) — use `uAccent` for the active layer;
- `texture2D(uTexA)` and `texture2D(uTexB)` mixed by `uMix`;
- `uReveal` 0→1 sweep bottom-to-top with a 2%-wide glowing accent edge (the "compile" intro);
- `uOpacity`, `uHighlight` (0..1 adds accent rim + slight brightness).
Connector lines: `LineSegments` linking the 4 corners of consecutive layers (dashed look via shader or plain with
low opacity), opacity tied to the "explode" amount (visible mostly in chapters 0–1).

**Textures** (`CanvasTexture`, 1024×640; 768×480 if viewport <768px; `anisotropy` max, `colorSpace` SRGB). Draw after
`await document.fonts.ready`. Use fonts 'Geist' and 'Geist Mono'. Redraw all on `themechange` using `--scene-*` tokens.
Every texture has a 1px inner hairline frame, a small mono label top-left, and real-feeling UI detail drawn with
rounded rects/lines (skeleton style, not lorem text). texA per layer:
0 Frontend — browser window: traffic-light dots, URL pill "~/resume", hero skeleton (big headline bars, two CTA pills).
1 UI & Styling — component kit: buttons (primary/ghost), toggle on/off, input field, chips, 5 color swatches.
2 State & Data — dashboard: KPI tiles + smooth line chart (accent) + bar chart (accent-2).
3 Backend — API graph: nodes "Client", "Next.js API", "NestJS", "PostgreSQL", "MongoDB" connected by curves, JWT badge.
4 Testing & Quality — test runner lines with ✓ marks in mint + 4 Lighthouse-style score rings "100".
5 Tools & Workflow — terminal: `git commit -m "feat: ship"`, CI pipeline steps (build ✓ test ✓ deploy ✓).
6 Foundation — design tokens grid: spacing scale bars + type ramp "Aa" sizes.
7 Ship — deploy card: "Production · Ready" status dot, `vercel --prod` line, response-time sparkline.
texB: layers 0–4 = job cards read from `.job[data-job=i]` dataset (company large, role, period, place, tech chips split on "·",
accent index "0i"); layers 5–7 = project screens from `.project[data-project=i-5]` (title, tech chips, a themed mini-illustration:
map with route+markers for project 0, admin table with sidebar for 1, dashboard cards+chart for 2).

**Formations** (`formations.js`): `pose(chapter, i, ctx) -> {p:[x,y,z], r:[x,y,z], s, o, mix, hl}` in group space.
ctx = `{ job, skill, project, aspect, mobile }`.
- 0 Stack: layers along z, gap 0.22, group rotation (-0.5, 0.62, 0.0) — isometric; mix 0.
- 1 Explode: gap 0.85, rotation (-0.32, 0.95, 0.02); mix 0.
- 2 Bento: layers 0–5 in 3×2 grid (cell 3.4×2.2 spacing, scale 0.92), facing camera with rotation (-0.08, -0.18, 0); layer `skill` → z+0.6,
  s×1.06, hl 1, others o 0.45 when a skill is focused; 6–7 shrink to s 0.001, o 0.
- 3 Carousel: layers 0–4 on a vertical arc; active job at (0,0,0.6) s 1.08 hl 1; others offset by (index-job): y ±1.25 per step,
  z −0.9·|d|, rotX 0.25·d, o 1−0.3·|d|; mix 1 for 0–4; 5–7 hidden.
- 4 Fan: layers 5–7 fanned (rotY ±0.42, x ±2.3, z −0.6 for sides); focused project centred & forward; 0–4 compressed stack far back
  (z −4, o 0.12); mix 1 for 5–7.
- 5 Ship: all layers gap 0.05, rotation (-0.45, t·0.25 turntable, 0), s 0.9; mix 0.
Per-layer **stagger**: when blending chapter k→k+1 with fraction f, layer i uses `f_i = smoothstep(0,1, clamp(f*1.6 - i*0.6/7, 0, 1))`.
All actual transforms chase targets with frame-rate-independent damping (`1 - exp(-dt*λ)`, λ≈6 position, 7 rotation).

**Placement**: group's world position/scale come from the chapters' `.stage` rects: for chapters k, k+1 weighted by f, take
stage centre in CSS px → NDC → world at z=0 (unproject with camera), and fit scale so the formation's ~4.2-unit width fits
the stage width (clamp 0.45–1.25). If the stage rect has zero size (mobile non-hero), use viewport centre, scale 0.72 and
global opacity 0.22 ("ambient"). Re-measure on resize + ResizeObserver(body); read rects every frame only via cached
section tops + scroll (no layout thrash: cache stage rects relative to document, recompute on resize).

**Scroll progress**: as v1 — boundary k morphs while section k's top moves from 85% to 25% of viewport.

**Pointer**: fine pointer only — group gets extra rotation (y ±0.18, x ±0.12) from normalised pointer, damped.
**Idle**: gentle float (each layer y += sin(t·0.6 + i)·0.03). **Intro**: on first frame, layers reveal 0→1 staggered 90ms,
duration 900ms, gap animates from 0 to 0.22. Reduced motion: no intro sweep, no float, no turntable; poses still follow scroll.

**Dust**: 1200 points (600 mobile) in a 18×12×10 box, slow drift, size attenuation, soft disc; additive in dark, normal blending
+ darker color in light (`--scene-blend`); opacity ~0.5.

**Lifecycle**: pause the loop when `document.hidden`; set `html.scene-ready` after first rendered frame.

## 8. Agent C — UI & entry (`src/main.js`, `src/ui/`)

`main.js`: import `./styles/index.css`? **No** — A links CSS in HTML. `main.js` imports and runs UI modules, then lazy-loads
the scene: after `load`, inside `requestIdleCallback` (fallback `setTimeout 200`): `import('./scene/index.js').then(m => m.init(document.getElementById('scene')))`.
Wrap in try/catch → `html.no-webgl`.

Modules (`src/ui/`), each exporting one `init*()` function, no globals:
- `theme.js` — toggle button; persist `localStorage.theme` (try/catch); follow system changes only when no stored pref;
  update `aria-pressed`, `aria-label` ("Switch to dark/light theme"), the two `meta[name=theme-color]`; View Transition circular
  reveal from the button centre (`document.startViewTransition` + `documentElement.animate({clipPath:[circle(0 at x y), circle(R at x y)]},{duration:520,easing:'cubic-bezier(.2,.7,.2,1)',pseudoElement:'::view-transition-new(root)'})`);
  instant switch if unsupported or reduced motion. Dispatch `themechange`. Mobile menu theme row reuses the same function.
- `nav.js` — active chapter from scroll (same 85%/25% rule, or IntersectionObserver on `[data-chapter]`), set `aria-current="true"` on
  `[data-nav=i]` links and `.on` on rail dots; `--progress` (0..1) on `html` via rAF-throttled scroll; `.is-scrolled` on `.site-nav`
  after 24px; mobile menu (`#menu-toggle`): toggles `hidden`, `html.menu-open`, `aria-expanded`, label; closes on Esc, link click,
  resize ≥768px; traps focus while open; locks body scroll.
- `palette.js` — opens on Ctrl/⌘+K and `#palette-open`; `[data-kbd-mod]` shows "⌘" on Mac else "Ctrl". Builds input + listbox in
  `#palette` (§6 class names), fuzzy-ish filter (case-insensitive substring over label+keywords), ↑/↓/Home/End, Enter runs, Esc closes,
  `aria-activedescendant`, groups "Navigate" (6 chapters), "Actions" (Toggle theme, Copy email, Print / Save as PDF),
  "Links" (GitHub, LinkedIn, X, Medium — open in new tab). Uses `showModal()`, restores focus on close, click on backdrop closes.
- `focus.js` — IntersectionObserver over `.job` (rootMargin `-45% 0px -45% 0px`) → `.is-active` + `jobfocus`; init with job 0.
  `.skill-group` and `.project` pointerenter/focusin/pointerleave/focusout → `skillfocus` / `projectfocus` (null on leave).
- `split.js` — `[data-split]`: preserve `<br>` as line breaks, wrap each char in `<span class="ch" aria-hidden="true" style="--i:n">`,
  wrap each line in `<span class="line">`, set `aria-label` with the plain text. Then add `html.is-loaded` after `document.fonts.ready`
  (max wait 1200ms).
- `count.js` — `[data-count]` animate 0→N with easeOutExpo over 1400ms when 50% visible; keep `data-suffix`; skip on reduced motion.
- `clock.js` — `[data-clock]` → `HH:MM` in `Asia/Tehran` via Intl (24h), `datetime` attr ISO; `[data-clock-diff]` → "3h 30m ahead of you" /
  "same time as you" / "…behind you" computed from offsets; refresh every 30s aligned to the minute.
- `copy.js` — `[data-copy]` → clipboard (fallback select+execCommand), toast "Email copied", button label briefly "Copied ✓".
  `toast.js` exports `toast(msg)` used by copy/palette (`#toast`, `.is-visible` for 2.2s).
- `magnetic.js` — `.magnetic` translate up to 6px toward pointer (pointer:fine, no reduced motion), spring back on leave.
- `misc.js` — `[data-print]` → `window.print()`; `[data-year]` → current year.

Respect `prefers-reduced-motion` everywhere. Zero console errors. Every listener passive where applicable.

## 9. Acceptance

- `npm run build` passes; initial JS (UI) < 15 KB gzip; scene chunk lazy.
- No horizontal scroll at 320–2560; both themes AA contrast for body text.
- Keyboard: every control reachable, visible focus, palette fully operable.
- Reduced motion honoured. No-JS: all content readable.
