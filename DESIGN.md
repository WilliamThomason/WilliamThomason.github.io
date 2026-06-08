---
version: alpha
name: William Thomason English
description: Dark-mode-first design for IT professionals — charcoal dark theme with lime green accents and California peach CTAs. Light mode uses deep gray with sky blue accents.
colors:
  dark-primary: "#1c1c1c"
  dark-bg2: "#161616"
  dark-bg3: "#222222"
  dark-card: "#232323"
  dark-border: "#333333"
  dark-text: "#e8e8e8"
  dark-muted: "#999999"
  dark-accent: "#a3e635"
  dark-cta: "#fcbe6a"
  dark-cta-text: "#1c1c1c"
  dark-popup-bg: "#dcfce7"
  dark-popup-text: "#1a2e1a"
  light-primary: "#f5f5f5"
  light-text: "#2f2f2f"
  light-accent: "#3097cf"
  light-cta: "#f59e0b"
  light-cta-text: "#ffffff"
  light-secondary: "#84cc16"
  light-popup-bg: "#e0f2fe"
  light-popup-text: "#0c4a6e"
typography:
  logo:
    fontFamily: Fira Code
    fontSize: 1.1rem
    fontWeight: 600
    letterSpacing: "1px"
  h1:
    fontFamily: Fira Code
    fontSize: 3.2rem
    fontWeight: 700
    lineHeight: 1.1
  h2:
    fontFamily: Fira Code
    fontSize: 2.2rem
    fontWeight: 700
  body:
    fontFamily: Blogger Sans
    fontSize: 1rem
    lineHeight: 1.6
  tagline:
    fontFamily: Fira Code
    fontSize: 1.15rem
    fontWeight: 500
rounded:
  sm: 8px
  md: 10px
  lg: 14px
  xl: 16px
  pill: 20px
spacing:
  section: 80px
  section-header: 56px
  card-gap: 20px
  grid-gap: 32px
components:
  button-cta:
    backgroundColor: "{colors.dark-cta}"
    textColor: "{colors.dark-cta-text}"
    rounded: "{rounded.md}"
    padding: 14px
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.dark-accent}"
    rounded: "{rounded.md}"
    padding: 14px
  card:
    backgroundColor: "{colors.dark-card}"
    textColor: "{colors.dark-text}"
    rounded: "{rounded.lg}"
    padding: 28px
  popup:
    backgroundColor: "{colors.dark-popup-bg}"
    textColor: "{colors.dark-popup-text}"
    rounded: "{rounded.xl}"
    padding: 28px
---

## Overview

William Thomason English is a dark-mode-first platform built by a developer, for IT professionals and their families. The design rejects the bright, generic aesthetic of large language platforms in favor of a charcoal dark theme that feels at home next to a terminal or IDE. Lime green provides energetic accents and secondary highlights, while California peach (#fcbe6a) drives all call-to-action buttons. The overall feel is clean, technical, and efficient — no fluff, no gradients, no glassmorphism.

Light mode is available via toggle and uses a deep gray (#2f2f2f) text on light gray (#f5f5f5) background, with sky blue (#3097cf) accents, peach (#fcbe6a) buttons, lime green (#84cc16) secondary accents, and mustard yellow (#f59e0b) CTAs.

## Colors

- **Dark Primary (#1c1c1c):** Main background — charcoal dark gray, easy on the eyes for long sessions.
- **Dark Accent (#a3e635):** Lime green — used for secondary accents, hover states, and animated glows on buttons.
- **Dark CTA (#fcbe6a):** California peach — the sole driver for all call-to-action buttons. High contrast against dark bg.
- **Dark CTA Text (#1c1c1c):** Dark text on peach buttons for readability.
- **Dark Popup (#dcfce7):** Light lime green background for definition/explainer popups. Dark text (#1a2e1a) for contrast.
- **Light Text (#2f2f2f):** Deep gray for body text in light mode.
- **Light Accent (#3097cf):** Sky blue — primary accent in light mode.
- **Light CTA (#f59e0b):** Mustard yellow — call to action in light mode.
- **Light Secondary (#84cc16):** Lime green — secondary accents in light mode.
- **Light Popup (#e0f2fe):** Light sky blue background for popups in light mode.

## Typography

- **Fira Code** (monospace) for logo, headings, section numbers, and the hero tagline. Gives a developer-friendly, technical feel.
- **Blogger Sans** for body text — clean, readable, modern.
- **Inter** as fallback for both.

No decorative fonts. Weight and size carry hierarchy, not font family variety.

## Layout

- Max content width: 1100px, centered.
- Section padding: 80px vertical, 40px horizontal (20px on mobile).
- Card gaps: 20px. Grid gaps: 32px.
- Sticky nav at 60px height with backdrop blur.
- Three-column grids collapse to single column at 900px.
- Fully responsive down to 320px.

## Shapes

- Modest border radius: 8px on buttons, 10px on interactive elements, 14px on cards, 16px on pricing cards, 20px on pill badges.
- No shadows by default. Subtle glow effects on CTA buttons using accent color.
- 1px borders using `--border` color for card definition.

## Components

- **CTA Buttons:** Peach background with dark text. Animated lime green glow pulse. Used for primary actions only.
- **Secondary Buttons:** Transparent with lime green border. Used for secondary actions.
- **Cards:** Dark card background with border. Hover raises 2-3px and highlights border with accent color.
- **Popups:** Light lime green (dark mode) or light sky blue (light mode) with dark text. Rounded corners, close button, click-outside-to-close.
- **Theme Toggle:** Pill button in nav with moon/sun icon. Persists preference to localStorage.
- **FAQ:** Accordion with smooth height transition. Arrow rotates on open.
- **Nav CTA:** Always visible, animated glow to draw attention.

## Do's and Don'ts

- **Do** use dark mode as the default — IT professionals expect it.
- **Do** keep the interface clean and minimal — every element should earn its place.
- **Do** use Fira Code for headings and Blogger Sans for body — no other font families.
- **Do** use token references in component definitions, not literal hex values.
- **Don't** use gradients, glassmorphism, or emoji.
- **Don't** use bright white backgrounds in dark mode.
- **Don't** nest component variants — `button-cta-hover` is a sibling key, not a child.
- **Don't** add decorative elements that don't serve a functional purpose.
- **Don't** use "per-lesson" pricing language — use "per session" instead.
