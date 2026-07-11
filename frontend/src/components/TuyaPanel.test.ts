import { beforeEach, describe, expect, it, vi } from 'vitest';

const errorToast = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ error: errorToast }),
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import TuyaPanel from './TuyaPanel.vue';
import { useTuyaStore } from '@/stores/tuya';

beforeEach(() => {
  errorToast.mockReset();
});

function seedDevices() {
  const tuya = useTuyaStore();
  tuya.devices = [
    { id: 'd1', name: 'Living', online: true, temp_current: 22.4, temp_set: 21 },
    { id: 'd2', name: 'Dormitor', online: false, temp_current: 18, temp_set: 20 },
  ] as any;
  return tuya;
}

describe('TuyaPanel.vue', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountWithPlugins(TuyaPanel, { props: { open: false } });
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('renders a card per device with formatted temperatures', async () => {
    const wrapper = mountWithPlugins(TuyaPanel, { props: { open: true } });
    seedDevices();
    await wrapper.vm.$nextTick();
    const cards = wrapper.findAll('.tuya-card');
    expect(cards).toHaveLength(2);
    expect(wrapper.find('.tuya-card-temp').text()).toBe('22.4°');
    expect(cards[1].classes()).toContain('offline');
  });

  it('marks the temperature warm when current >= target', async () => {
    const wrapper = mountWithPlugins(TuyaPanel, { props: { open: true } });
    seedDevices();
    await wrapper.vm.$nextTick();
    // Living: 22.4 >= 21 → warm
    expect(wrapper.find('.tuya-card-temp').classes()).toContain('warm');
  });

  it('shows the empty state when there are no devices', async () => {
    const wrapper = mountWithPlugins(TuyaPanel, { props: { open: true } });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.empty').exists()).toBe(true);
  });

  it('refresh button calls the store and reports a store error', async () => {
    const wrapper = mountWithPlugins(TuyaPanel, { props: { open: true } });
    const tuya = seedDevices();
    const refresh = vi.spyOn(tuya, 'refresh').mockImplementation(async () => {
      tuya.error = 'cloud down';
    });
    await wrapper.vm.$nextTick();
    await wrapper.find('.tuya-refresh-btn').trigger('click');
    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalled();
    expect(errorToast).toHaveBeenCalled();
  });

  it('emits close from the header button', async () => {
    const wrapper = mountWithPlugins(TuyaPanel, { props: { open: true } });
    await wrapper.vm.$nextTick();
    const closeBtn = wrapper.findAll('.modal-head .icon-btn').at(-1);
    await closeBtn!.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
