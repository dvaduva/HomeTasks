import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StandbyOverlay from './StandbyOverlay.vue';
import { mountWithPlugins } from '@/test/mountWithPlugins';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StandbyOverlay', () => {
  it('renders the clock and emits wake on click', async () => {
    const wrapper = mountWithPlugins(StandbyOverlay);
    expect(wrapper.find('.standby-overlay').exists()).toBe(true);
    expect(wrapper.find('.standby-time').exists()).toBe(true);
    expect(wrapper.find('.standby-date').exists()).toBe(true);

    await wrapper.find('.standby-overlay').trigger('click');
    expect(wrapper.emitted('wake')).toHaveLength(1);
  });

  it('moves the clock to a new position over time', async () => {
    const wrapper = mountWithPlugins(StandbyOverlay);
    const clock = wrapper.find('.standby-clock');
    const initial = clock.attributes('style');
    await vi.advanceTimersByTimeAsync(45_000);
    await wrapper.vm.$nextTick();
    expect(clock.attributes('style')).not.toBe(initial);
  });
});
