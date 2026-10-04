# Card

Container component for grouped content with consistent spacing and elevation.

## Variants

**Base**: `surface` background (#ffffff light, #14261d dark) with a 1px `border` hairline, on the green-tinted `background`.
**Elevated**: Adds `shadow-sm` at rest.
**Interactive**: Lifted variant with hover state: `translateY(-4px)` lift on hover, `shadow-lg`, border accent color. Used for clickable cards (achievements, habit previews).

## Sizing

- **Padding**: 16px (`space-4`) standard, 24px (`space-6`) for hero/stat cards
- **Border radius**: 16px (`radius-lg`)
- **Minimum height**: No minimum; content-driven

## States

- **Rest**: `shadow-sm` (elevated only)
- **Hover** (interactive): `translateY(-4px)`, `shadow-lg`, border becomes `primary` at 25%, 200ms ease
- **Dark theme**: Darker background with adjusted contrast

## Usage

Base cards for static content layout. Interactive cards for navigation or selection (quests, achievements, habit summaries).

## Code Example

```tsx
<Card variant="elevated">
  <h3>Card Title</h3>
  <p>Content here</p>
</Card>

<Card variant="interactive" onClick={handleSelect}>
  <Icon />
  <p>Clickable card (cursor pointer)</p>
</Card>
```
