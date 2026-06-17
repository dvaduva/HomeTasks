import { beforeEach, describe, expect, it, vi } from 'vitest';

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ success, error: errorToast }),
}));

vi.mock('@/api/wifi', () => ({
  wifiApi: {
    status: vi.fn().mockResolvedValue({ available: true, connected: false, ssid: null, ip: null }),
    scan: vi.fn().mockResolvedValue({ networks: [], available: true, error: null }),
    connect: vi.fn().mockResolvedValue({ ok: true }),
    disconnect: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import WiFiManager from './WiFiManager.vue';
import { wifiApi } from '@/api/wifi';

const NETS = [
  { ssid: 'HomeNet', signal: 80, security: 'WPA2', in_use: false },
  { ssid: 'OpenCafe', signal: 40, security: null, in_use: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  (wifiApi.status as any).mockResolvedValue({ available: true, connected: false, ssid: null, ip: null });
  (wifiApi.scan as any).mockResolvedValue({ networks: NETS, available: true, error: null });
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('WiFiManager.vue', () => {
  it('loads status and scans when the tab becomes active', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    expect(wifiApi.status).toHaveBeenCalled();
    expect(wifiApi.scan).toHaveBeenCalled();
    expect(wrapper.findAll('.wifi-item')).toHaveLength(2);
  });

  it('does nothing while inactive', async () => {
    mountWithPlugins(WiFiManager, { props: { active: false } });
    await flush();
    expect(wifiApi.scan).not.toHaveBeenCalled();
  });

  it('toggles the password field for a secured network', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    // First item is the secured HomeNet.
    await wrapper.findAll('.wifi-item')[0].trigger('click');
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wifiApi.connect).not.toHaveBeenCalled(); // secured → waits for password
  });

  it('connects directly to an open network', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    await wrapper.findAll('.wifi-item')[1].trigger('click'); // OpenCafe (no security)
    await flush();
    expect(wifiApi.connect).toHaveBeenCalledWith('OpenCafe', undefined);
    expect(success).toHaveBeenCalled();
  });

  it('connects to a secured network with the typed password', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    await wrapper.findAll('.wifi-item')[0].trigger('click');
    await wrapper.find('input[type="password"]').setValue('hunter2');
    await wrapper.find('.wifi-connect-row .btn-primary').trigger('click');
    await flush();
    expect(wifiApi.connect).toHaveBeenCalledWith('HomeNet', 'hunter2');
  });

  it('surfaces a scan error from the payload', async () => {
    (wifiApi.scan as any).mockResolvedValue({ networks: [], available: true, error: 'nmcli failed' });
    mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    expect(errorToast).toHaveBeenCalledWith('nmcli failed');
  });

  it('shows the connected status and disconnects', async () => {
    (wifiApi.status as any).mockResolvedValue({ available: true, connected: true, ssid: 'HomeNet', ip: '192.168.0.5' });
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    expect(wrapper.find('.wifi-status').classes()).toContain('connected');
    await wrapper.find('.wifi-status .btn-secondary').trigger('click');
    await flush();
    expect(wifiApi.disconnect).toHaveBeenCalled();
  });
});
