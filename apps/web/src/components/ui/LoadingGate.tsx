import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A single timing contract for every transient loading state in LifeQuest. */
export const LOADER_DELAY_MS = 200;
export const LOADER_MIN_VISIBLE_MS = 400;

/**
 * Tracks browser-tab visibility so motion-based loaders can pause their work
 * while the application is not visible.
 */
export function usePageVisibility() {
  const [isPageVisible, setIsPageVisible] = useState(() => (
    typeof document === 'undefined' ? true : !document.hidden
  ));

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return isPageVisible;
}

interface LoadingVisibilityOptions {
  delayMs?: number;
  minVisibleMs?: number;
}

/**
 * Shows a pending state only after the shared delay. Once shown, it remains
 * mounted for the minimum duration, preventing a one-frame loading flash.
 */
export function useLoadingVisibility(
  loading: boolean,
  {
    delayMs = LOADER_DELAY_MS,
    minVisibleMs = LOADER_MIN_VISIBLE_MS,
  }: LoadingVisibilityOptions = {},
) {
  const [isVisible, setIsVisible] = useState(false);
  const delayTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const visibleAtRef = useRef<number | null>(null);

  useEffect(() => {
    const clearDelayTimer = () => {
      if (delayTimerRef.current !== null) {
        window.clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    };
    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    if (loading) {
      clearHideTimer();

      if (!isVisible) {
        clearDelayTimer();
        delayTimerRef.current = window.setTimeout(() => {
          visibleAtRef.current = Date.now();
          delayTimerRef.current = null;
          setIsVisible(true);
        }, delayMs);
      }

      return () => clearDelayTimer();
    }

    clearDelayTimer();

    if (!isVisible) return undefined;

    const elapsed = Date.now() - (visibleAtRef.current ?? Date.now());
    const remaining = Math.max(0, minVisibleMs - elapsed);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      visibleAtRef.current = null;
      setIsVisible(false);
    }, remaining);

    return () => clearHideTimer();
  }, [delayMs, isVisible, loading, minVisibleMs]);

  useEffect(() => () => {
    if (delayTimerRef.current !== null) window.clearTimeout(delayTimerRef.current);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
  }, []);

  return isVisible;
}

export interface LoadingGateProps extends LoadingVisibilityOptions {
  loading: boolean;
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * Keeps the current content in place until a loader has earned its appearance.
 * Consumers can use it without adding an extra layout wrapper.
 */
export function LoadingGate({
  loading,
  fallback,
  children,
  delayMs,
  minVisibleMs,
}: LoadingGateProps) {
  const shouldShowLoader = useLoadingVisibility(loading, { delayMs, minVisibleMs });
  return <>{shouldShowLoader ? fallback : children}</>;
}
