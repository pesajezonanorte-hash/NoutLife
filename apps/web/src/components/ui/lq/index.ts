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
export { Confetti } from './Confetti';
export { BarChart, LineChart, Heatmap, type BarDatum, type LinePoint, type HeatLevel } from './Charts';
export type { Tone } from './tones';
