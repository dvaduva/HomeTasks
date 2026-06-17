import { beforeEach, describe, expect, it, vi } from 'vitest';

const success = vi.fn();
const errorToast = vi.fn();
const confirmMock = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ success, error: errorToast, confirm: confirmMock }),
}));
vi.mock('@/api/wifi', () => ({
  wifiApi: { status: vi.fn().mockResolvedValue({ available: false }) },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import SettingsPanel from './SettingsPanel.vue';
import { wifiApi } from '@/api/wifi';
import { usePreferencesStore } from '@/stores/preferences';
import { useUsersStore } from '@/stores/users';
import { useAiStore } from '@/stores/ai';

// WiFiManager has its own suite; stub it here.
const stubs = { WiFiManager: { template: '<div class="wifi-stub" />' } };

beforeEach(() => {
  vi.clearAllMocks();
  (wifiApi.status as any).mockResolvedValue({ available: false });
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// open watch isn't immediate → mount closed, seed prefs, then open.
async function mountOpen() {
  const wrapper = mountWithPlugins(SettingsPanel, { props: { open: false }, global: { stubs } });
  const prefs = usePreferencesStore();
  prefs.data = { language: 'ro', date_format: 'short', time_format: '24', weather_city: 'Cluj' } as any;
  await wrapper.setProps({ open: true });
  await flush();
  return { wrapper, prefs };
}

describe('SettingsPanel.vue', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountWithPlugins(SettingsPanel, { props: { open: false }, global: { stubs } });
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('switches to the users tab', async () => {
    const { wrapper } = await mountOpen();
    const users = useUsersStore();
    users.items = [{ id: 1, name: 'Ana', color: '#f00' }] as any;
    await wrapper.vm.$nextTick();
    // Second tab button is "Users".
    await wrapper.findAll('.tab-btn')[1].trigger('click');
    expect(wrapper.findAll('.settings-user-row')).toHaveLength(1);
  });

  it('saves preferences and emits close', async () => {
    const { wrapper } = await mountOpen();
    const prefs = usePreferencesStore();
    const update = vi.spyOn(prefs, 'update').mockResolvedValue({} as any);
    await wrapper.find('.modal-actions .btn-primary').trigger('click');
    await flush();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ language: 'ro', weather_city: 'Cluj' }));
    expect(wrapper.emitted('close')).toBeTruthy();
  });

  it('validates an empty new-user name', async () => {
    const { wrapper } = await mountOpen();
    const users = useUsersStore();
    const create = vi.spyOn(users, 'create');
    await wrapper.findAll('.tab-btn')[1].trigger('click');
    await wrapper.find('.settings-add-user .btn-primary').trigger('click'); // blank name
    expect(errorToast).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('adds a user', async () => {
    const { wrapper } = await mountOpen();
    const users = useUsersStore();
    const create = vi.spyOn(users, 'create').mockResolvedValue({ id: 2 } as any);
    await wrapper.findAll('.tab-btn')[1].trigger('click');
    await wrapper.find('.settings-add-user input[type="text"]').setValue('Bob');
    await wrapper.find('.settings-add-user .btn-primary').trigger('click');
    await flush();
    expect(create).toHaveBeenCalledWith('Bob', expect.any(String));
    expect(success).toHaveBeenCalled();
  });

  it('loads AI models on demand', async () => {
    const { wrapper } = await mountOpen();
    const ai = useAiStore();
    const load = vi.spyOn(ai, 'loadModels').mockResolvedValue(undefined);
    await wrapper.findAll('.tab-btn')[3].trigger('click'); // AI tab
    await wrapper.find('.input-with-btn .btn-secondary').trigger('click');
    await flush();
    expect(load).toHaveBeenCalled();
  });

  it('reveals the Network tab only when Wi-Fi is available', async () => {
    (wifiApi.status as any).mockResolvedValue({ available: true });
    const { wrapper } = await mountOpen();
    const labels = wrapper.findAll('.tab-btn').map((b) => b.text());
    expect(labels.some((l) => /Rețea|Network/i.test(l))).toBe(true);
  });
});
