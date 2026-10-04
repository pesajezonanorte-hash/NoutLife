# StatCard

A card displaying a statistic: icon + animated count-up number + label + optional link.

## Structure

- **Icon**: 32px, primary or semantic color
- **Number**: Count-up animation (400ms ease-out from 0 to final value)
- **Label**: `on-surface-light` (#4f6b5c light, #8fae9c dark); XP and gold numbers use `secondary-text` in JetBrains Mono
- **Link**: Optional trailing chevron or "View more" text

## Interaction

- **Count-up**: Triggered on mount or when value changes. Respects `useReducedMotion`.
- **Hover** (if linked): Underline appears on label/link, border lifts, shadow-md

## Variants

- **Small**: Icon 24px, number 20px, label 12px
- **Large**: Icon 32px, number 32px, label 14px

## Usage

Displayed in grids on Dashboard (HP/MP/XP), Finances (spending, savings), Achievements (count of unlocked). Used with semantic colors: success for gains, error for losses, warning for currency.

## Code Example

```tsx
<StatCard
  icon={<HeartIcon />}
  value={75}
  label="Health Points"
  color="error"
  link="/profile/stats"
/>
```
