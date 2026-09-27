"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type SliderPrimitiveProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

interface SliderProps extends SliderPrimitiveProps {
  /** Optional semantic accent. Defaults to the active LifeQuest primary color. */
  accent?: string;
}

/**
 * Shared accessible range control based on Radix Slider.
 *
 * It replaces browser-native range inputs so the thumb, focus state and track
 * remain legible in both LifeQuest themes and on touch devices.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, accent = "var(--primary)", style, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2",
      className,
    )}
    style={{ ...style, "--slider-accent": accent } as React.CSSProperties}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full border border-[var(--border)] bg-[var(--bg-deep)]">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--slider-accent)] transition-[width] duration-150 ease-out" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-5 w-5 rounded-full border-2 border-[var(--slider-accent)] bg-[var(--bg-panel)] shadow-sm transition-[box-shadow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slider-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-panel)] disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
