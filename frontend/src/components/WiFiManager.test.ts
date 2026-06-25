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

  it('types the password with the on-screen keyboard and connects', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    await wrapper.findAll('.wifi-item')[0].trigger('click'); // secured HomeNet
    // The second trailing button in the field opens the keyboard.
    await wrapper.findAll('.wifi-pw-btn')[1].trigger('click');
    expect(wrapper.find('.osk').exists()).toBe(true);
    // Tap a few letter keys, then Enter.
    const keys = wrapper.findAll('.osk-key');
    await keys.find((k) => k.text() === 'a')!.trigger('click');
    await keys.find((k) => k.text() === 'b')!.trigger('click');
    await keys.find((k) => k.text() === 'c')!.trigger('click');
    await wrapper.find('.osk-key-enter').trigger('click');
    await flush();
    expect(wifiApi.connect).toHaveBeenCalledWith('HomeNet', 'abc');
  });

  it('toggles password visibility', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    await wrapper.findAll('.wifi-item')[0].trigger('click');
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    await wrapper.findAll('.wifi-pw-btn')[0].trigger('click');
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
  });

  it('connects to a hidden network typed in by hand', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    // Hidden networks never appear in the scan list — open the manual form.
    await wrapper.find('.wifi-hidden-toggle').trigger('click');
    expect(wrapper.find('.wifi-hidden-form').exists()).toBe(true);
    await wrapper.find('.wifi-hidden-ssid').setValue('SecretAP');
    await wrapper.find('.wifi-hidden-form input[type="password"]').setValue('s3cret');
    await wrapper.find('.wifi-hidden-form .btn-primary').trigger('click');
    await flush();
    expect(wifiApi.connect).toHaveBeenCalledWith('SecretAP', 's3cret', true);
    expect(success).toHaveBeenCalled();
  });

  it('omits the password for an open hidden network', async () => {
    const wrapper = mountWithPlugins(WiFiManager, { props: { active: true } });
    await flush();
    await wrapper.find('.wifi-hidden-toggle').trigger('click');
    await wrapper.find('.wifi-hidden-ssid').setValue('OpenHidden');
    await wrapper.find('.wifi-hidden-form .btn-primary').trigger('click');
    await flush();
    expect(wifiApi.connect).toHaveBeenCalledWith('OpenHidden', undefined, true);
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
