---
name: Sweet Cotton Candy & Berry
colors:
  surface: '#f9f9ff'
  surface-dim: '#d0daf0'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d9e3f9'
  on-surface: '#121c2c'
  on-surface-variant: '#544245'
  inverse-surface: '#273141'
  inverse-on-surface: '#ebf1ff'
  outline: '#877275'
  outline-variant: '#dac0c4'
  surface-tint: '#9b3f5a'
  primary: '#9b3f5a'
  on-primary: '#ffffff'
  primary-container: '#ff8fab'
  on-primary-container: '#79243f'
  inverse-primary: '#ffb1c2'
  secondary: '#30628a'
  on-secondary: '#ffffff'
  secondary-container: '#a1d1fe'
  on-secondary-container: '#265a81'
  tertiary: '#056d34'
  on-tertiary: '#ffffff'
  tertiary-container: '#6bc380'
  on-tertiary-container: '#004f23'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e0'
  primary-fixed-dim: '#ffb1c2'
  on-primary-fixed: '#3f0018'
  on-primary-fixed-variant: '#7d2742'
  secondary-fixed: '#cde5ff'
  secondary-fixed-dim: '#9bcbf8'
  on-secondary-fixed: '#001d32'
  on-secondary-fixed-variant: '#104a70'
  tertiary-fixed: '#9cf6ae'
  tertiary-fixed-dim: '#81da94'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005225'
  background: '#f9f9ff'
  on-background: '#121c2c'
  surface-variant: '#d9e3f9'
  bg-primary: '#FFF8F9'
  bg-surface-subtle: '#FFEBF0'
  primary-hover: '#FB6F92'
  secondary-light: '#BDE0FE'
  success: '#72EFDD'
  warning: '#FFD166'
  border-subtle: '#FFE0E6'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
This design system balances clinical precision with an empathetic, approachable aesthetic tailored for medical reporting. By utilizing a "Soft Pastel" style, the interface reduces patient and clinician anxiety through warmth and clarity.

The aesthetic blends **Minimalism** with subtle **Glassmorphism**, emphasizing high-quality whitespace and soft, tinted elevations. The brand personality is gentle, clean, and optimistic, ensuring that complex medical data feels manageable and human-centric rather than cold or institutional.

## Colors
The palette is rooted in a "Pink Cream Wash" (`#FFF8F9`) background to differentiate from standard sterile white interfaces. 

- **Primary Strawberry Pink** is reserved for high-priority actions and brand signifiers.
- **Cotton Blue** serves as a secondary accent for informational callouts and supplementary data visualization.
- **Neutral Slate Gray** provides high legibility for medical text without the harshness of pure black.
- **Functional Pastels** (Mint and Butter) are used for status indicators, ensuring they remain harmonious with the overall soft-tone environment.

## Typography
**Plus Jakarta Sans** is the exclusive typeface for this design system. Its modern, geometric construction and soft curves mirror the "Cotton Candy" aesthetic while maintaining the professional clarity required for medical documentation.

Hierarchies are established through purposeful weight shifts rather than excessive size variance. Headlines use a tighter letter-spacing to feel cohesive and authoritative, while body text maintains standard tracking for optimal readability in dense medical reports.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a soft 4px baseline rhythm. Medical reports are complex, so the layout prioritizes breathing room through generous margins and gutters.

- **Desktop:** 12-column grid with 24px gutters.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px margins.

Content is grouped into logical clusters using cards to manage information density. Use the `lg` (24px) spacing unit for vertical separation between report sections to prevent cognitive overload.

## Elevation & Depth
Depth is created using a signature **Strawberry-Pink Tinted Shadow** rather than traditional neutral grays. This reinforces the brand's warmth even in its structural hierarchy.

- **Base Level:** `bg-primary` (#FFF8F9) is the foundation.
- **Surface Level:** Cards and primary containers use `bg-surface` (#FFFFFF) with a 1px border in `#FFE0E6`.
- **Raised Level:** Used for active states or floating elements, applying the shadow: `0 4px 14px 0 rgba(255, 143, 171, 0.12)`.
- **Interactive Depth:** Hover states should transition to a slightly deeper shadow or a subtle background shift to `bg-surface-subtle`.

## Shapes
The shape language is purposefully soft to contrast the clinical nature of the content. 

- **Cards & Containers:** Use a consistent `16px` (rounded-lg equivalent) radius.
- **Action Elements:** Buttons, chips, and pills use a hyper-rounded `24px` (rounded-xl/full equivalent) radius to evoke a "pill" or "tablet" shape, subtly referencing the medical context.
- **Inputs:** Follow the card radius (16px) for a unified form-factor.

## Components
### Buttons & Pills
Buttons are high-contrast with the primary strawberry pink. Use the 24px corner radius for all primary actions. Text inside buttons should be `label-md` weight. Secondary buttons use a `secondary-light` background with `text-main`.

### Cards
All report data should be housed in white cards with the 16px radius. Borders are mandatory (`1px solid #FFE0E6`) to provide definition against the pink-cream background.

### Input Fields
Inputs use `#FFEBF0` (bg-surface-subtle) as a background color to signify interactability. They should transition to a primary-colored border on focus.

### Status Badges
Status chips (e.g., Cat-B badges) utilize the pill shape (24px radius). They feature a light background (`#FFE5EC`) and a defined primary border (`#FF8FAB`) to ensure they stand out as critical data points.

### Medical Data Lists
Lists should feature horizontal dividers in `#FFE0E6` and use `body-md` for primary information and `text-muted` (body-sm) for metadata or descriptions.