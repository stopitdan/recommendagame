# Design System

Visual identity and component guidelines for Recommend a Game.

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| **Granite** | `#3A4F41` | Primary brand color. Header, nav, primary buttons, text on light backgrounds. |
| **Rosewood** | `#B9314F` | Accent / CTA. Action buttons, selected states, alerts, badges. |
| **Rosy Taupe** | `#D5A18E` | Secondary / warm accent. Hover states, progress bars, secondary buttons. |
| **Almond Silk** | `#DEC3BE` | Warm background. Page backgrounds, card fills, subtle dividers. |
| **Alabaster Grey** | `#E1DEE3` | Cool neutral. Card backgrounds, borders, disabled states. |
| **Charcoal** | `#2A2A2A` | Primary text color. |
| **Warm White** | `#FAF7F5` | Page background. |
| **Pure White** | `#FFFFFF` | Card surfaces, input fields. |

### Dark tints (derived)

| Name | Hex | Usage |
|------|-----|-------|
| Granite Dark | `#2D3D32` | Header hover, active states |
| Rosewood Dark | `#9A2840` | CTA hover |
| Rosewood Light | `#F2E0E4` | Rosewood chip/tag background |

---

## Typography

- **Font:** Roboto (already loaded via next/font/google)
- **Headings:** Weight 700, Granite color
- **Body:** Weight 400, Charcoal color
- **Captions:** Weight 400, muted text (text.secondary)

---

## Component Guidelines

### Buttons
- **Primary (CTA):** Rosewood background, white text, slight border-radius (8px), subtle shadow
- **Secondary:** Outlined with Granite border, Granite text
- **Text:** No background, Granite text, underline on hover

### Cards
- White background, subtle border (`Alabaster Grey`), border-radius 12px
- Slight shadow on hover (elevation transition)
- Selected state: Rosewood border, Rosewood Light background

### Chips / Tags
- Default: Alabaster Grey background, Charcoal text
- Selected: Rosewood background, white text
- Genre chips, mood tags, category labels

### Inputs
- White background, Alabaster Grey border
- Focus: Granite border with subtle glow

### Progress Bar
- Track: Alabaster Grey
- Fill: gradient from Granite → Rosy Taupe

---

## Motion

Keep animations subtle and purposeful:
- **Page transitions:** Fade in (200ms ease-out)
- **Card hover:** Slight lift (translateY -2px) + shadow increase (200ms)
- **Button hover:** Background color darken (150ms)
- **Step transitions:** Slide left/right (250ms ease-out) in questionnaire
- **Chip select:** Scale pop (1.0 → 1.05 → 1.0, 150ms)

---

## Spacing

Use MUI's spacing scale (1 unit = 8px):
- `spacing(1)` = 8px (tight)
- `spacing(2)` = 16px (standard)
- `spacing(3)` = 24px (comfortable)
- `spacing(4)` = 32px (section gaps)
