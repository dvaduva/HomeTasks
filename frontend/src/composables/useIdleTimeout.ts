import { onMounted, onUnmounted, ref, watch, type MaybeRefOrGetter, toValue } from 'vue';

export interface IdleTimeoutOptions {
  timeoutMs: MaybeRefOrGetter<number>;
  enabled?: MaybeRefOrGetter<boolean>;
  paused?: MaybeRefOrGetter<boolean>;
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;

export function useIdleTimeout(options: IdleTimeoutOptions) {
  const isIdle = ref(false);
  let timer: number | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule(): void {
    clearTimer();
    if (!toValue(options.enabled ?? true) || toValue(options.paused ?? false)) {
      if (!toValue(options.enabled ?? true)) isIdle.value = false;
      return;
    }
    timer = window.setTimeout(() => {
      isIdle.value = true;
    }, toValue(options.timeoutMs));
  }

  function reset(): void {
    isIdle.value = false;
    schedule();
  }

  function onActivity(): void {
    reset();
  }

  function onVisibility(): void {
    if (document.visibilityState === 'visible') reset();
    else clearTimer();
  }

  onMounted(() => {
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    schedule();
  });

  onUnmounted(() => {
    for (const event of ACTIVITY_EVENTS) {
      document.removeEventListener(event, onActivity);
    }
    document.removeEventListener('visibilitychange', onVisibility);
    clearTimer();
  });

  watch(
    () => [toValue(options.timeoutMs), toValue(options.enabled ?? true), toValue(options.paused ?? false)] as const,
    () => {
      if (!isIdle.value) schedule();
    },
  );

  return { isIdle, reset };
}
