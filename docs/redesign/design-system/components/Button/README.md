# Button

Button component for primary, secondary, ghost, danger, and icon actions.

## Variants

**Primary**: `primary-strong` fill (jade-700 light, jade-400 dark) with `on-primary` text; `primary-hover` on hover. One per view.
**Secondary**: `surface-variant` fill, `on-background` text, `border-strong` border.
**Ghost**: Transparent with border and text. Low-priority actions, links within content.
**Danger**: `error-text` fill with white text (6.7:1). Destructive actions only, always confirmed.
**Icon**: Square, icon-only, minimal visual weight. 44px minimum touch target.

## Sizes

- **LG**: 16px text, 12px × 20px padding (inner)
- **MD**: 14px text, 10px × 16px padding (standard)
- **SM**: 12px text, 8px × 12px padding (compact)

## Interactions

- **Rest**: `shadow-sm`, no transform
- **Hover** (non-disabled): `translateY(-1px)`, `shadow-md`, 100ms ease
- **Active**: `scale(0.97)`, 50ms snap-back
- **Disabled**: 55% opacity, cursor not-allowed

## States

All variants support `:disabled` styling. Focus ring: 3px solid `primary` with 2px offset. Reward CTAs (claim XP) may use `secondary` gold, sparingly.

## Code Example

```tsx
<Button variant="primary" size="md">
  Primary Action
</Button>

<Button variant="secondary" disabled>
  Disabled
</Button>

<Button variant="danger" onClick={handleDelete}>
  Delete
</Button>
```
