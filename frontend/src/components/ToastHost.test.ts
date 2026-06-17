import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import ToastHost from './ToastHost.vue';
import { useNotification } from '@/composables/useNotification';

beforeEach(() => {
  vi.useFakeTimers();
  // useNotification keeps module-level state — clear any leftovers.
  const n = useNotification();
  n.state.toasts.forEach((t) => n.dismiss(t.id));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastHost.vue', () => {
  it('renders an active toast with its kind class', async () => {
    const wrapper = mountWithPlugins(ToastHost);
    const n = useNotification();
    n.success('gata');
    await wrapper.vm.$nextTick();
    const toast = wrapper.find('.toast');
    expect(toast.exists()).toBe(true);
    expect(toast.classes()).toContain('toast-success');
    expect(toast.text()).toBe('gata');
  });

  it('clicking a toast dismisses it', async () => {
    const wrapper = mountWithPlugins(ToastHost);
    const n = useNotification();
    n.toast('hello', { timeoutMs: 0 });
    await wrapper.vm.$nextTick();
    await wrapper.find('.toast').trigger('click');
    expect(wrapper.find('.toast').exists()).toBe(false);
  });

  it('shows the confirm dialog and resolves true on confirm', async () => {
    const wrapper = mountWithPlugins(ToastHost);
    const n = useNotification();
    const pending = n.confirm('sigur ștergi?');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.confirm-dialog').exists()).toBe(true);
    expect(wrapper.find('.confirm-message').text()).toBe('sigur ștergi?');

    await wrapper.find('.btn-primary').trigger('click');
    await expect(pending).resolves.toBe(true);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.confirm-dialog').exists()).toBe(false);
  });

  it('resolves false on cancel', async () => {
    const wrapper = mountWithPlugins(ToastHost);
    const n = useNotification();
    const pending = n.confirm('sigur?');
    await wrapper.vm.$nextTick();
    await wrapper.find('.btn-secondary').trigger('click');
    await expect(pending).resolves.toBe(false);
  });
});
