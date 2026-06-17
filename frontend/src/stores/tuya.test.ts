import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/tuya', () => ({
  tuyaApi: { temperatures: vi.fn(), refresh: vi.fn() },
}));

import { tuyaApi } from '@/api/tuya';
import { useTuyaStore } from './tuya';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('tuya store', () => {
  it('fetch applies devices and generated_at', async () => {
    (tuyaApi.temperatures as any).mockResolvedValue({
      devices: [{ id: 'd1', name: 'Living', temp_current: 22.5 }],
      generated_at: '2026-06-17T10:00:00Z',
    });
    const store = useTuyaStore();
    await store.fetch();
    expect(store.devices).toHaveLength(1);
    expect(store.updatedAt).toBe('2026-06-17T10:00:00Z');
    expect(store.error).toBeNull();
  });

  it('fetch surfaces a soft error field from the payload', async () => {
    (tuyaApi.temperatures as any).mockResolvedValue({ devices: [], error: 'no data file' });
    const store = useTuyaStore();
    await store.fetch();
    expect(store.error).toBe('no data file');
  });

  it('fetch captures a thrown error', async () => {
    (tuyaApi.temperatures as any).mockRejectedValue(new Error('offline'));
    const store = useTuyaStore();
    await store.fetch();
    expect(store.error).toBe('offline');
    expect(store.loading).toBe(false);
  });

  it('refresh pulls from cloud then re-reads temperatures', async () => {
    (tuyaApi.refresh as any).mockResolvedValue({ success: true, device_count: 2 });
    (tuyaApi.temperatures as any).mockResolvedValue({
      devices: [{ id: 'a' }, { id: 'b' }],
      generated_at: 'now',
    });
    const store = useTuyaStore();
    await store.refresh();
    expect(tuyaApi.refresh).toHaveBeenCalled();
    expect(tuyaApi.temperatures).toHaveBeenCalled();
    expect(store.devices).toHaveLength(2);
  });

  it('refresh records a cloud error but still re-reads', async () => {
    (tuyaApi.refresh as any).mockResolvedValue({ error: 'bad credentials' });
    (tuyaApi.temperatures as any).mockResolvedValue({ devices: [], generated_at: null });
    const store = useTuyaStore();
    await store.refresh();
    expect(store.error).toBe('bad credentials');
    expect(tuyaApi.temperatures).toHaveBeenCalled();
  });
});
