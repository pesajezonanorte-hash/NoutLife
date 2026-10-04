# ProgressBar

Linear progress indicator for health, mana, experience, and other meters.

## Variants

- **Default**: Theme color (primary, success, warning, error, info)
- **With label**: Percentage or text above/below
- **Animated**: `scaleX` from 0 to value, 500ms ease

## Styling

- **Height**: 8px (`stat-bar`)
- **Radius**: 999px (fully rounded)
- **Track**: `surface-variant` (jade-50 light, #1c3328 dark)
- **Fill**: `primary` by default; `error` for HP, `info` for MP, `secondary` gold for XP
- **Shine effect** (optional): Animated gradient sweep left to right, 2.6s ease-in-out

## States

- **Empty**: 0% fill
- **Partial**: Current/max value
- **Full**: 100% fill

## Usage

Character stat meters (HP, MP in battle), quest progress, experience to next level, daily challenge completion, financial tracking (budget vs. spent).

## Code Example

```tsx
<ProgressBar value={65} max={100} color="primary" />
<ProgressBar value={45} max={100} color="error" label="45 / 100" shine />
```
