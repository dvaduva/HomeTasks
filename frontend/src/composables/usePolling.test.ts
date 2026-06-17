import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { usePolling } from './usePolling';

// usePolling relies on onMounted/onUnmounted, so we drive it through a host
// component rather than calling it bare.
function host(fn: () => unknown, options: Parameters<typeof usePolling>[1]) {
  return defineComponent({
    setup() {
      const p = usePolling(fn, options);
      return () => h('div', { 'data-running': String(p.running.value) });
    },
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePolling', () => {
  it('ticks immediately by default, then on each interval', async () => {
    const fn = vi.fn();
    const wrapper = mount(host(fn, { intervalMs: 1000 }));
    expect(fn).toHaveBeenCalledTimes(1); // immediate
    // Async advance flushes the microtask between ticks so the re-entrancy guard
    // (running flag) clears and each interval fire actually runs fn.
    await vi.advanceTimersByTimeAsync(3000);
    expect(fn).toHaveBeenCalledTimes(4); // + 3 interval ticks
    wrapper.unmount();
  });

  it('skips the immediate tick when immediate is false', () => {
    const fn = vi.fn();
    mount(host(fn, { intervalMs: 1000, immediate: false }));
    expect(fn).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not start the interval when paused', () => {
    const fn = vi.fn();
    mount(host(fn, { intervalMs: 1000, paused: true }));
    expect(fn).toHaveBeenCalledTimes(1); // immediate still runs
    vi.advanceTimersByTime(5000);
    expect(fn).toHaveBeenCalledTimes(1); // but no interval ticks
  });

  it('stops ticking after unmount', () => {
    const fn = vi.fn();
    const wrapper = mount(host(fn, { intervalMs: 1000 }));
    wrapper.unmount();
    fn.mockClear();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not overlap a still-running async tick', async () => {
    let resolve!: () => void;
    const fn = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    mount(host(fn, { intervalMs: 1000 }));
    expect(fn).toHaveBeenCalledTimes(1); // immediate tick in flight
    vi.advanceTimersByTime(2000); // two interval fires, but tick is still running
    expect(fn).toHaveBeenCalledTimes(1); // re-entrancy guard held
    resolve();
  });
});
