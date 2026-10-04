// Componentes del rediseño (docs/redesign). Viven en ui/lq/ para no chocar con
// los componentes heredados de ui/ (EmptyState, ModalFrame, button…), que
// siguen en uso hasta que cada pantalla se migre.
export { Button, buttonClasses, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Card, type CardProps } from './Card';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export { IconChip, type IconChipProps } from './IconChip';
export { Input, Select, Textarea, Field, type InputProps, type SelectProps, type TextareaProps, type FieldProps } from './Field';
export { Switch } from './Switch';
export { SegmentedControl, type SegmentOption } from './SegmentedControl';
export { Tabs } from './Tabs';
export { CheckButton } from './CheckButton';
export { ProgressBar, ProgressRing } from './Progress';
export { StatCard, AnimatedValue } from './StatCard';
export { Toast, Toaster, useToast } from './Toast';
export { Modal, Sheet, ResponsiveDialog, useDialogBehavior, type ModalProps } from './Modal';
export { EmptyState, ErrorState, PageLoader, Skeleton } from './States';
export { Spinner } from './Spinner';
export { ModernLoader, type ModernLoaderProps } from './ModernLoader';
export { Confetti } from './Confetti';
export { BarChart, LineChart, Heatmap, type BarDatum, type LinePoint, type HeatLevel } from './Charts';
export type { Tone } from './tones';
export { ChipGroup, chipClasses, type ChipOption, type ChipGroupProps } from './Chip';
export { DayDot, type DayStatus, type DayDotProps } from './DayDot';
export { StepItem, type StepItemProps } from './StepItem';
export { Timer, formatClock, type TimerProps } from './Timer';
export { BookCover, type BookCoverProps } from './BookCover';
export { MoodPicker, MoodFace, MOODS, moodOf, type MoodPickerProps } from './MoodPicker';
export { TimelineDay, type TimelineItem, type TimelineDayProps } from './TimelineDay';
export { MonthGrid, type MonthGridProps } from './MonthGrid';
export { DatePicker, type DatePickerProps } from './DatePicker';
export { SpotCard, type SpotCardProps } from './SpotCard';
export { AccordionItem, type AccordionItemProps } from './Accordion';
export { OtpInput, type OtpInputProps } from './OtpInput';
export { Countdown, type CountdownProps } from './Countdown';
export { AreaChart, RadarChart, smoothPath, type AreaChartProps, type RadarChartProps, type RadarAxis } from './AdvancedCharts';
export { BossBar, SeasonPassTrack, Podium, LeaderRow, QuoteCard, type BossBarProps, type PassReward, type Leader, type LeaderRowProps, type QuoteCardProps } from './Game';
export { ShopItem, PurchaseDialog, ThemePreviewDialog, GoldPrice, type ShopItemProps, type ThemePalette } from './Shop';
export { SabioComposer, type SabioComposerProps } from './SabioComposer';
