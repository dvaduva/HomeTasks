import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/radio', () => ({
  radioApi: {
    stations: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    nowPlaying: vi.fn().mockResolvedValue({ title: '' }),
    proxyUrl: (id: string) => `/api/radio/proxy/${id}`,
  },
}));
vi.mock('@/api/cast', () => ({
  castApi: { status: vi.fn().mockResolvedValue({}), devices: vi.fn(), play: vi.fn(), stop: vi.fn(), volume: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/api/bt', () => ({
  btApi: { status: vi.fn().mockResolvedValue({}), devices: vi.fn(), play: vi.fn(), stop: vi.fn(), volume: vi.fn() },
}));

// jsdom doesn't implement HTMLMediaElement playback — stub a minimal fake.
class FakeAudio {
  paused = true;
  src = '';
  volume = 1;
  preload = '';
  addEventListener = vi.fn();
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
}

import { radioApi } from '@/api/radio';
import { castApi } from '@/api/cast';
import { useRadioStore } from './radio';

const S = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, name: id.toUpperCase(), url: `http://stream/${id}`, proxy: false, ...over }) as any;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal('Audio', FakeAudio as any);
  setActivePinia(createPinia());
});

describe('radio store — getters', () => {
  it('outputKind / isRemote / bareDeviceId follow the target prefix', () => {
    const store = useRadioStore();
    expect(store.outputKind).toBe('local');
    expect(store.isRemote).toBe(false);

    store.target = 'cast:uuid-1';
    expect(store.outputKind).toBe('cast');
    expect(store.isRemote).toBe(true);

    store.target = 'bt:AA:BB';
    expect(store.outputKind).toBe('bt');
    expect(store.isRemote).toBe(true);
  });

  it('currentStation resolves the playing station', () => {
    const store = useRadioStore();
    store.stations = [S('a'), S('b')];
    store.currentId = 'b';
    expect(store.currentStation!.id).toBe('b');
  });

  it('sortedStations puts favorites first', () => {
    const store = useRadioStore();
    store.stations = [S('a'), S('b'), S('c')];
    store.toggleFavorite('c');
    expect(store.sortedStations.map((s) => s.id)[0]).toBe('c');
  });
});

describe('radio store — volume & mute', () => {
  it('setVolume clamps to 0..100 and persists', () => {
    const store = useRadioStore();
    store.setVolume(150);
    expect(store.volume).toBe(100);
    store.setVolume(-20);
    expect(store.volume).toBe(0);
    expect(localStorage.getItem('rd-volume')).toBe('0');
  });

  it('muted reflects a zero volume', () => {
    const store = useRadioStore();
    store.setVolume(0);
    expect(store.muted).toBe(true);
  });

  it('toggleMute restores the previous level', () => {
    const store = useRadioStore();
    store.setVolume(60);
    store.toggleMute();
    expect(store.volume).toBe(0);
    store.toggleMute();
    expect(store.volume).toBe(60);
  });

  it('setVolume on a cast target calls castApi.volume', () => {
    const store = useRadioStore();
    store.target = 'cast:uuid-1';
    store.setVolume(50);
    expect(castApi.volume).toHaveBeenCalledWith('uuid-1', 0.5);
  });
});

describe('radio store — favorites', () => {
  it('toggleFavorite adds then removes and persists', () => {
    const store = useRadioStore();
    store.toggleFavorite('a');
    expect(store.isFavorite('a')).toBe(true);
    expect(JSON.parse(localStorage.getItem('rd-favorites')!)).toEqual(['a']);
    store.toggleFavorite('a');
    expect(store.isFavorite('a')).toBe(false);
  });
});

describe('radio store — navigation', () => {
  it('playNext / playPrev wrap around the station list', () => {
    const store = useRadioStore();
    store.stations = [S('a'), S('b'), S('c')];
    store.currentId = 'c';
    store.playNext(); // c -> a (wrap)
    expect(store.currentId).toBe('a');
    store.playPrev(); // a -> c (wrap)
    expect(store.currentId).toBe('c');
  });

  it('play marks the station active and persists last id', () => {
    const store = useRadioStore();
    store.play(S('a'));
    expect(store.currentId).toBe('a');
    expect(localStorage.getItem('rd-last-station')).toBe('a');
    expect(localStorage.getItem('rd-playing')).toBe('1');
  });
});

describe('radio store — output target', () => {
  it('setTarget switches target and pre-warms a cast device', () => {
    const store = useRadioStore();
    store.setTarget('cast:uuid-9');
    expect(store.target).toBe('cast:uuid-9');
    expect(castApi.status).toHaveBeenCalledWith('uuid-9');
  });

  it('targetName falls back gracefully for unknown devices', () => {
    const store = useRadioStore();
    expect(store.targetName('local')).toBeTruthy();
    store.castDevices = [{ id: 'uuid-1', name: 'Living' }] as any;
    expect(store.targetName('cast:uuid-1')).toBe('Living');
  });
});

describe('radio store — admin', () => {
  it('refreshStations loads from the API', async () => {
    (radioApi.stations as any).mockResolvedValue({ stations: [S('a'), S('b')] });
    const store = useRadioStore();
    await store.refreshStations();
    expect(store.stations).toHaveLength(2);
    expect(store.loadFailed).toBe(false);
  });

  it('createStation posts then refreshes the list', async () => {
    (radioApi.create as any).mockResolvedValue(S('new'));
    (radioApi.stations as any).mockResolvedValue({ stations: [S('new')] });
    const store = useRadioStore();
    const created = await store.createStation({ name: 'New', url: 'http://x' } as any);
    expect(created.id).toBe('new');
    expect(radioApi.create).toHaveBeenCalled();
    expect(store.stations).toHaveLength(1);
  });

  it('deleteStation clears current playback when deleting the live station', async () => {
    (radioApi.remove as any).mockResolvedValue(undefined);
    (radioApi.stations as any).mockResolvedValue({ stations: [] });
    const store = useRadioStore();
    store.stations = [S('a')];
    store.currentId = 'a';
    await store.deleteStation('a');
    expect(store.currentId).toBeNull();
    expect(radioApi.remove).toHaveBeenCalledWith('a');
  });

  it('reorderStations applies the returned order', async () => {
    (radioApi.reorder as any).mockResolvedValue({ stations: [S('b'), S('a')] });
    const store = useRadioStore();
    await store.reorderStations(['b', 'a']);
    expect(store.stations.map((s) => s.id)).toEqual(['b', 'a']);
  });
});
