import { beforeEach, describe, expect, it, vi } from 'vitest';

const success = vi.fn();
const errorToast = vi.fn();
const confirmMock = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ success, error: errorToast, confirm: confirmMock }),
}));

vi.mock('@/api/bt', () => ({
  btApi: {
    scan: vi.fn(),
    pair: vi.fn().mockResolvedValue({ ok: true }),
    remove: vi.fn().mockResolvedValue({ ok: true }),
    devices: vi.fn().mockResolvedValue({ devices: [], available: true }),
  },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import BluetoothManager from './BluetoothManager.vue';
import { btApi } from '@/api/bt';

const DEVICES = [
  { id: 'AA:BB', name: 'JBL', connected: false, paired: false },
  { id: 'CC:DD', name: 'Sony', connected: true, paired: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  (btApi.scan as any).mockResolvedValue({ devices: DEVICES });
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

// The open watch isn't immediate, so a fresh mount must toggle open false→true
// to trigger the auto-scan.
async function mountOpen() {
  const wrapper = mountWithPlugins(BluetoothManager, { props: { open: false } });
  await wrapper.setProps({ open: true });
  await flush();
  return wrapper;
}

describe('BluetoothManager.vue', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountWithPlugins(BluetoothManager, { props: { open: false } });
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('scans on open and lists discovered devices', async () => {
    const wrapper = mountWithPlugins(BluetoothManager, { props: { open: false } });
    await wrapper.setProps({ open: true });
    await flush();
    expect(btApi.scan).toHaveBeenCalledWith(10);
    expect(wrapper.findAll('.bt-mgr-item')).toHaveLength(2);
    // Connected device gets the "connected" badge class.
    expect(wrapper.find('.bt-mgr-badge.connected').exists()).toBe(true);
  });

  it('pairs an unpaired device', async () => {
    const wrapper = await mountOpen();
    // First item (JBL) is unpaired → shows the pair button (btn-primary).
    await wrapper.findAll('.bt-mgr-item')[0].find('.btn-primary').trigger('click');
    await flush();
    expect(btApi.pair).toHaveBeenCalledWith('AA:BB');
    expect(success).toHaveBeenCalled();
  });

  it('forgets a paired device after confirmation', async () => {
    confirmMock.mockResolvedValue(true);
    const wrapper = await mountOpen();
    await wrapper.findAll('.bt-mgr-item')[1].find('.btn-danger').trigger('click');
    await flush();
    expect(confirmMock).toHaveBeenCalled();
    expect(btApi.remove).toHaveBeenCalledWith('CC:DD');
  });

  it('does not forget when the confirm is declined', async () => {
    confirmMock.mockResolvedValue(false);
    const wrapper = await mountOpen();
    await wrapper.findAll('.bt-mgr-item')[1].find('.btn-danger').trigger('click');
    await flush();
    expect(btApi.remove).not.toHaveBeenCalled();
  });

  it('shows the empty state when no devices are found', async () => {
    (btApi.scan as any).mockResolvedValue({ devices: [] });
    const wrapper = mountWithPlugins(BluetoothManager, { props: { open: true } });
    await flush();
    expect(wrapper.find('.bt-mgr-empty').exists()).toBe(true);
  });

  it('emits close from the header button', async () => {
    const wrapper = mountWithPlugins(BluetoothManager, { props: { open: true } });
    await flush();
    await wrapper.find('.modal-head .icon-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
