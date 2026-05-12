import { onMounted, onUnmounted, ref } from 'vue';

export interface PollingOptions {
  intervalMs: number;
  immediate?: boolean;
  paused?: boolean;
}

export function usePolling(fn: () => unknown | Promise<unknown>, options: PollingOptions) {
  const timer = ref<number | null>(null);
  const running = ref(false);

  async function tick(): Promise<void> {
    if (running.value) return;
    running.value = true;
    try {
      await fn();
    } finally {
      running.value = false;
    }
  }

  function start(): void {
    stop();
    timer.value = window.setInterval(tick, options.intervalMs);
  }

  function stop(): void {
    if (timer.value !== null) {
      clearInterval(timer.value);
      timer.value = null;
    }
  }

  onMounted(() => {
    if (options.immediate !== false) tick();
    if (!options.paused) start();
  });

  onUnmounted(() => {
    stop();
  });

  return { start, stop, tick, running };
}
