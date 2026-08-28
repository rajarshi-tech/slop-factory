## GLOBALS.CSS — SLOP FACTORY DESIGN TOKENS

Update the project's **`globals.css`** to establish the complete SLOP FACTORY visual foundation using **Tailwind CSS**.

This is a **Next.js + Tailwind CSS** project. Do not create a separate styling system or introduce unnecessary CSS architecture.

The purpose of this change is to establish a centralized color palette and reusable design tokens that the rest of the frontend can use consistently.

### Color Palette

Use the following exact base colors:

```css
--background: #080B10;
--surface: #0D1117;
--surface-elevated: #111720;

--primary: #00A8FF;
--primary-hover: #33B8FF;
--primary-muted: #0077B5;

--warning: #FFD43B;
--warning-hover: #FFE16A;
--warning-muted: #B89A00;

--foreground: #F1F5F9;
--foreground-secondary: #94A3B8;
--foreground-muted: #64748B;

--success: #3DDC84;
--error: #FF4D5A;
```

### Borders

Define dedicated border colors rather than repeatedly hardcoding them:

```css
--border: #1E2732;
--border-subtle: #151C25;
--border-active: #00A8FF;
--border-warning: #FFD43B;
```

The default border should be subtle and low contrast.

### Terminal Colors

Create specific variables for terminal output:

```css
--terminal-background: #070A0E;
--terminal-text: #CBD5E1;
--terminal-blue: #00A8FF;
--terminal-warning: #FFD43B;
--terminal-success: #3DDC84;
--terminal-error: #FF4D5A;
```

### Status Colors

Create semantic variables:

```css
--status-running: #00A8FF;
--status-complete: #3DDC84;
--status-waiting: #64748B;
--status-attention: #FFD43B;
--status-error: #FF4D5A;
```

These should be reused throughout the application instead of defining different colors for each component.

---

## Tailwind Integration

Expose the colors through the Tailwind theme according to the version of Tailwind already installed in the project.

If the project uses **Tailwind CSS v4**, prefer the modern `@theme` approach rather than creating a legacy `tailwind.config.js` solely for these colors.

For example, structure the theme around semantic names such as:

```text
background
surface
surface-elevated
primary
primary-hover
primary-muted
warning
warning-hover
warning-muted
foreground
foreground-secondary
foreground-muted
border
border-subtle
border-active
border-warning
success
error
terminal-background
terminal-text
status-running
status-complete
status-waiting
status-attention
status-error
```

The exact implementation should follow the Tailwind version already present in the project.

---

## Global Styling

Set the global application background to:

`#080B10`

Set the default text color to:

`#F1F5F9`

Use the modern sans-serif font as the default UI font.

Use **JetBrains Mono** or **IBM Plex Mono** for technical/terminal elements. If the project already has an appropriate monospace font configured, reuse it rather than introducing a duplicate.

Set appropriate global antialiasing.

Avoid global styles that force rounded corners, shadows, gradients, or other visual characteristics onto every component.

---

## Design Rules

The color variables must be the **single source of truth** for the SLOP FACTORY color palette.

Do NOT scatter arbitrary hex values throughout the application.

When implementing components, prefer semantic Tailwind classes such as:

```text
bg-background
bg-surface
bg-surface-elevated
text-foreground
text-foreground-secondary
text-foreground-muted
border-border
text-primary
bg-primary
text-warning
text-success
text-error
```

rather than hardcoded colors.

Maintain the following semantic meaning everywhere:

**Blue**
→ active / running / primary action

**Yellow**
→ user attention required / warning / confirmation

**Green**
→ completed / successful

**Red**
→ failed / destructive

**Gray**
→ inactive / waiting / unavailable

The palette should remain dark, restrained and professional. Do not introduce additional bright accent colors without a strong functional reason.

Do not modify the application's functionality while making this change. This task is specifically about establishing the global visual design system in `globals.css`.
