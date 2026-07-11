import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useIdleTimeout } from './useIdleTimeout';

function mountIdle(options: {
  timeoutMs?: number;
  enabled?: boolean;
  paused?: boolean;
}) {
  const timeoutMs = ref(options.timeoutMs ?? 1000);
  const enabled = ref(options.enabled ?? true);
  const paused = ref(options.paused ?? false);

  const Comp = defineComponent({
    setup() {
      return { ...useIdleTimeout({ timeoutMs, enabled, paused }), timeoutMs, enabled, paused };
    },
    render: () => h('div'),
  });

  return { wrapper: mount(Comp), timeoutMs, enabled, paused };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useIdleTimeout', () => {
  it('becomes idle after the timeout elapses', async () => {
    const { wrapper } = mountIdle({ timeoutMs: 5000 });
    expect(wrapper.vm.isIdle).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.vm.isIdle).toBe(true);
  });

  it('resets the timer on user activity', async () => {
    const { wrapper } = mountIdle({ timeoutMs: 5000 });
    await vi.advanceTimersByTimeAsync(3000);
    document.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(3000);
    expect(wrapper.vm.isIdle).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.vm.isIdle).toBe(true);
  });

  it('wakes from idle on activity', async () => {
    const { wrapper } = mountIdle({ timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(wrapper.vm.isIdle).toBe(true);
    document.dispatchEvent(new Event('pointerdown'));
    expect(wrapper.vm.isIdle).toBe(false);
  });

  it('does not go idle when disabled', async () => {
    const { wrapper } = mountIdle({ timeoutMs: 1000, enabled: false });
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.vm.isIdle).toBe(false);
  });

  it('does not go idle while paused', async () => {
    const { wrapper } = mountIdle({ timeoutMs: 1000, paused: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(wrapper.vm.isIdle).toBe(false);
  });
});
