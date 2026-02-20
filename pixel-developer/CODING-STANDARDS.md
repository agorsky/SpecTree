# Pixel Developer — Coding Standards

These standards apply to all code changes made by the Pixel Developer pipeline. The `pd-standards-enforcer` agent audits changes against these rules, and the `pd-fixer` agent must comply with them.

---

## 1. BEM Naming Convention

All CSS class names **MUST** use Block-Element-Modifier (BEM) syntax.

### Syntax

```
.block-name {}                       // Block
.block-name__element-name {}         // Element
.block-name--modifier-name {}        // Modifier
.block-name__element-name--modifier {} // Element with modifier
```

### Rules

| Rule | Example | Counter-Example |
|------|---------|-----------------|
| Blocks use lowercase kebab-case | `.user-profile` | `.userProfile`, `.UserProfile` |
| Elements use `__` (double underscore) | `.card__title` | `.card_title`, `.card-title` |
| Modifiers use `--` (double hyphen) | `.card--active` | `.card-active`, `.card.active` |
| Max 1 element depth | `.card__title` | `.card__header__title` |
| No standalone modifiers | `.card--large` | `.--large` |

### SCSS Nesting for BEM

```scss
// ✅ Correct BEM nesting
.card {
  display: flex;
  
  &__header {
    padding: var(--spacing-md);
  }
  
  &__title {
    font-size: var(--font-size-lg);
  }
  
  &--featured {
    border-color: var(--color-primary);
  }
}

// ❌ Wrong — nested elements
.card {
  &__header {
    &__title {  // This creates .card__header__title — BEM violation
      font-size: var(--font-size-lg);
    }
  }
}
```

### Refactoring Nested Elements

When the design has nested structures, create sub-blocks:

```scss
// Instead of .card__header__title, use:
.card-header {           // New block for the header
  &__title { ... }
  &__subtitle { ... }
}
```

---

## 2. CSS Variable (Custom Property) Usage

### Mandatory Token Categories

All visual values **MUST** reference CSS custom properties (design tokens):

| Category | Token Pattern | Example |
|----------|--------------|---------|
| Colors | `var(--color-*)` | `var(--color-primary)`, `var(--color-text-secondary)` |
| Spacing | `var(--spacing-*)` | `var(--spacing-sm)`, `var(--spacing-lg)` |
| Font sizes | `var(--font-size-*)` | `var(--font-size-sm)`, `var(--font-size-xl)` |
| Font weights | `var(--font-weight-*)` | `var(--font-weight-bold)`, `var(--font-weight-semi)` |
| Line heights | `var(--line-height-*)` | `var(--line-height-tight)`, `var(--line-height-normal)` |
| Border radius | `var(--radius-*)` | `var(--radius-sm)`, `var(--radius-full)` |
| Shadows | `var(--shadow-*)` | `var(--shadow-sm)`, `var(--shadow-card)` |
| Z-index | `var(--z-*)` | `var(--z-dropdown)`, `var(--z-modal)` |

### Allowed Raw Values

These values do **not** require tokens:

```scss
// Allowed raw values
width: 0;                // Zero
border: 1px solid ...;   // 1px thin border
border-radius: 50%;      // Perfect circle
border-radius: 9999px;   // Pill shape
width: 100%;             // Full width
height: auto;            // Intrinsic height
flex: 1;                 // Flex grow
opacity: 0.5;            // Component-specific opacity
```

### Token Definition Location

New tokens should be added to the project's token definition file:

```scss
// tokens/_colors.scss or :root in tokens.css
:root {
  --color-primary: #3B82F6;
  --color-primary-hover: #2563EB;
  --color-surface: #FFFFFF;
  --color-surface-raised: #F9FAFB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
}
```

### Fallback Values

When using tokens that might not be defined in all contexts:

```scss
// ✅ Fallback for safety
color: var(--color-text-primary, #111827);

// ❌ No fallback — will break if token is missing
color: var(--color-text-primary);
```

Use fallbacks only for tokens that are newly introduced or used in isolated components.

---

## 3. Forbidden Import Patterns

### No `@use` or `@forward`

The project uses CSS custom properties for token access. SCSS `@use` and `@forward` are **forbidden**:

```scss
// ❌ FORBIDDEN
@use 'variables' as *;
@use '../tokens/colors' as colors;
@forward 'mixins';
@use 'sass:math';

// ✅ ALLOWED — if SCSS variables are absolutely necessary
@import 'variables';
@import 'mixins';

// ✅ PREFERRED — CSS custom properties (no import needed)
.card {
  background: var(--color-surface);
  padding: var(--spacing-md);
}
```

**Rationale:** CSS custom properties work at runtime and don't require build-time imports. `@use`/`@forward` introduce module scoping that conflicts with the project's global token architecture.

---

## 4. Angular Component Patterns

### File Structure

```
feature-name/
  feature-name.component.ts        // Component class
  feature-name.component.html      // Template
  feature-name.component.scss      // Styles
  feature-name.component.spec.ts   // Tests
```

### Style Encapsulation

```typescript
@Component({
  selector: 'app-feature-name',
  templateUrl: './feature-name.component.html',
  styleUrls: ['./feature-name.component.scss'],
  // Default ViewEncapsulation.Emulated — do NOT change unless necessary
})
```

### Host Element Styling

```scss
// ✅ Use :host for component-level styles
:host {
  display: block;
  width: 100%;
}

// ✅ Host modifier based on attribute
:host([variant="compact"]) {
  padding: var(--spacing-sm);
}

// ❌ Do not style the component tag from outside
app-feature-name {
  display: block;  // This should be in :host
}
```

### Template Conventions

```html
<!-- ✅ BEM classes in templates -->
<div class="feature-name">
  <header class="feature-name__header">
    <h2 class="feature-name__title">{{ title }}</h2>
  </header>
  <div class="feature-name__body">
    <ng-content></ng-content>
  </div>
</div>

<!-- ❌ Non-BEM classes -->
<div class="featureName">
  <header class="header">
    <h2 class="title">{{ title }}</h2>
  </header>
</div>
```

---

## 5. Selector Rules

### Specificity Limits

```scss
// ✅ Single class selector (specificity: 0-1-0)
.card__title {
  font-size: var(--font-size-lg);
}

// ✅ Modifier on element (specificity: 0-2-0)
.card__title--emphasized {
  font-weight: var(--font-weight-bold);
}

// ❌ Over-qualified (specificity: 0-2-0 unnecessarily)
.card .card__title {
  font-size: var(--font-size-lg);
}

// ❌ ID selector (specificity: 1-0-0)
#card-title {
  font-size: var(--font-size-lg);
}

// ❌ !important (nuclear specificity)
.card__title {
  font-size: var(--font-size-lg) !important;
}
```

### Maximum Nesting Depth: 3

```scss
// ✅ Depth 2 — acceptable
.card {
  &__title {
    color: var(--color-text-primary);
  }
}

// ✅ Depth 3 — maximum allowed
.card {
  &__title {
    &--active {
      color: var(--color-primary);
    }
  }
}

// ❌ Depth 4 — too deep
.card {
  &__body {
    &__content {
      &__title {
        color: var(--color-text-primary);
      }
    }
  }
}
```

---

## 6. Layout Conventions

### Flexbox First

Use flexbox for all 1-dimensional layouts:

```scss
.card-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.card__actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-sm);
}
```

### Grid for 2D Layouts

Use CSS Grid for 2-dimensional layouts (rows AND columns):

```scss
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}
```

### No Float Layouts

`float` is forbidden for layout purposes. Use flexbox or grid.

### Gap Over Margin

Prefer `gap` on containers over `margin` on children:

```scss
// ✅ Gap on parent
.list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

// ❌ Margin on children
.list__item {
  margin-bottom: var(--spacing-sm);
  &:last-child {
    margin-bottom: 0;
  }
}
```

---

## 7. Responsive Design

### Mobile-First Media Queries

```scss
// Base styles are for mobile
.card {
  padding: var(--spacing-sm);
}

// Scale up for larger viewports
@media (min-width: 768px) {
  .card {
    padding: var(--spacing-md);
  }
}

@media (min-width: 1024px) {
  .card {
    padding: var(--spacing-lg);
  }
}
```

### Breakpoint Tokens

Use the project's breakpoint values, not arbitrary numbers:
- Mobile: `< 768px`
- Tablet: `768px – 1023px`
- Desktop: `≥ 1024px`
- Wide: `≥ 1440px`

---

## 8. Accessibility Requirements

### Color Contrast

All text must meet WCAG 2.1 AA contrast ratios:
- Normal text (< 18px): 4.5:1 minimum
- Large text (≥ 18px or 14px bold): 3:1 minimum

### Focus Indicators

Interactive elements must have visible focus styles:

```scss
.button {
  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}
```

### Semantic HTML

Use semantic elements for their intended purpose:
- `<button>` for actions, not `<div onClick>`
- `<a>` for navigation
- `<h1>`–`<h6>` for headings in order
- `<nav>`, `<main>`, `<aside>`, `<footer>` for landmarks
