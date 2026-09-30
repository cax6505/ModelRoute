# ModelRoute Design System

## Direction

ModelRoute is a precise control plane printed on warm paper: calm, clear, high-contrast, and operational. The interface uses warm neutral surfaces, generous whitespace, hairline borders, restrained elevation, and vermilion active routing signals. It should feel like trusted infrastructure software, not a generic AI dashboard or writing assistant.

## Foundations

- Canvas: `#F6F4EF`; surfaces: `#FFFFFF`; sunken surface: `#EFECE5`.
- Ink: `#16130F`; muted ink: `#5E5A52`; faint ink: `#9A958B`.
- Hairline border: `rgba(22,19,15,0.08)`; strong border: `rgba(22,19,15,0.14)`.
- Accent: vermilion `#FF4A1C`, with a restrained tint and hover token reserved for active routes, focus rings, and primary actions. Keep the accent consistent in both themes.
- Provider hues are fixed: Groq `#2F54EB`, Gemini `#0E9F8E`, Ollama `#D98A0B`.
- Status colors are success `#14803C`, warning `#B54708`, and danger `#D92D20`, each paired with a 10% tint.
- Radius scale: 8, 12, 16, 24px. Spacing follows a 4px grid.
- Elevation uses three warm-tinted layers: rest, raised, and floating. No harsh black shadows.

## Type

Bricolage Grotesque is used for headings and display text. Geist is used for UI and body copy. Geist Mono is limited to code, IDs, tabular numbers, and prompt/output panels. Type sizes are 12, 13, 14, 16, 20, 28, and 40px. Labels use sentence case; no all-caps mono micro-labels.

## Layout

The sidebar is 264px on desktop. Content is capped at 1360px with page padding of 32px on desktop, 24px on tablet, and 16px on mobile. At 390px the sidebar becomes a drawer or bottom sheet. All layouts must preserve readable controls and stable dimensions.

## Motion

Motion is transform and opacity only, with reduced-motion fallbacks. The standard easing is `cubic-bezier(0.2, 0, 0, 1)` and emphasized easing is `cubic-bezier(0.16, 1, 0.3, 1)`. Micro, base, and page durations are 120ms, 220ms, and 420ms. UI springs use stiffness 380 and damping 32. Page content fades and rises 8px with a 40ms child stagger. Active navigation and segmented controls use shared layout indicators.

Buttons press down by 1px and step up one shadow level on hover. Counts animate on mount, charts draw in on first view, lists stagger into place, and drawers scale from 0.98 with a fading backdrop. Streaming output uses a blinking caret and stable scrolling.

## Shared primitives

Use the shared design-system primitives for Card, Stat, Chip, ProviderDot, SegmentedControl, DataTable, Drawer, EmptyState, Skeleton, PageHeader, and Kbd. shadcn/ui remains the accessible behavioral base, but its visual treatment comes only from the token layer and variants. Components must expose hover, focus-visible, active, disabled, and loading states where applicable.

## Product surfaces

The app shell contains the ModelRoute wordmark, six route-aware navigation items with `⌘1` through `⌘6` keycaps, an infrastructure status panel for Groq, Gemini, and Ollama, a page header, and the circuit breaker state. The dashboard routes retain their existing data flow and behavior while adopting these shared primitives.

The six product views are Playground Studio, Request Audit Logs, Analytics & Costs, Routing Policy, Eval Harness, and API Credentials. Each view should prioritize the primary workflow, keep dense data scannable, and use real empty, loading, error, and responsive states.

## Accessibility and theme architecture

Use semantic controls, keyboard navigation, visible 2px accent focus rings, WCAG AA contrast, and reduced-motion media queries. Light values live on `:root`; the same semantic variables are overridden under `[data-theme="dark"]` so dark theme work does not require component rewrites.
