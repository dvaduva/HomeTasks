import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

// onMounted calls radio.init() (reads stations) + loadOutputDevices(); mock the
// API layer so those are harmless and init populates the station list for us.
// The station list is inlined here because vi.mock factories are hoisted above
// any top-level consts.
vi.mock('@/api/radio', () => ({
  radioApi: {
    stations: vi.fn().mockResolvedValue({
      stations: [
        { id: 'zu', name: 'Radio ZU', url: 'http://zu', genre: 'Pop' },
        { id: 'rock', name: 'Rock FM', url: 'http://rock', genre: 'Rock' },
      ],
    }),
    nowPlaying: vi.fn().mockResolvedValue({ title: '' }),
    proxyUrl: (id: string) => `/api/radio/proxy/${id}`,
  },
}));
vi.mock('@/api/cast', () => ({
  castApi: { devices: vi.fn().mockResolvedValue({ devices: [] }), status: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@/api/bt', () => ({
  btApi: { devices: vi.fn().mockResolvedValue({ devices: [], available: false }) },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import RadioView from './RadioView.vue';
import { useRadioStore } from '@/stores/radio';

const stubs = {
  RadioStationsManager: { props: ['open'], template: '<div class="mgr-stub" :data-open="open" />' },
  BluetoothManager: { props: ['open'], template: '<div class="bt-stub" :data-open="open" />' },
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal('Audio', class { addEventListener() {} play() { return Promise.resolve(); } pause() {} } as any);
});

async function mountRadio() {
  const wrapper = mountWithPlugins(RadioView, { global: { stubs } });
  await flushPromises(); // let init() resolve and populate stations
  return { wrapper, radio: useRadioStore() };
}

describe('RadioView.vue', () => {
  it('lists the stations', async () => {
    const { wrapper } = await mountRadio();
    expect(wrapper.findAll('.rd-station')).toHaveLength(2);
  });

  it('filters stations via the search box', async () => {
    const { wrapper } = await mountRadio();
    await wrapper.find('.rd-search input').setValue('rock');
    expect(wrapper.findAll('.rd-station')).toHaveLength(1);
    expect(wrapper.find('.rd-station-name').text()).toBe('Rock FM');
  });

  it('disables the play button when nothing is selected', async () => {
    const { wrapper } = await mountRadio();
    expect(wrapper.find('.rd-btn-play').attributes('disabled')).toBeDefined();
  });

  it('clicking a station calls onStationClick', async () => {
    const { wrapper, radio } = await mountRadio();
    const click = vi.spyOn(radio, 'onStationClick').mockImplementation(() => {});
    await wrapper.findAll('.rd-station-main')[0].trigger('click');
    expect(click).toHaveBeenCalledWith(expect.objectContaining({ id: 'zu' }));
  });

  it('the favorite button calls toggleFavorite', async () => {
    const { wrapper, radio } = await mountRadio();
    const fav = vi.spyOn(radio, 'toggleFavorite').mockImplementation(() => {});
    await wrapper.findAll('.rd-station-fav')[0].trigger('click');
    expect(fav).toHaveBeenCalledWith('zu');
  });

  it('the volume slider calls setVolume', async () => {
    const { wrapper, radio } = await mountRadio();
    const setVol = vi.spyOn(radio, 'setVolume').mockImplementation(() => {});
    const slider = wrapper.find('.rd-volume');
    (slider.element as HTMLInputElement).value = '42';
    await slider.trigger('input');
    expect(setVol).toHaveBeenCalledWith(42);
  });

  it('picking a destination from the popup calls setTarget', async () => {
    const { wrapper, radio } = await mountRadio();
    const setTarget = vi.spyOn(radio, 'setTarget').mockImplementation(() => {});
    radio.castDevices = [{ id: 'uuid-1', name: 'Living' }] as any;
    // open the picker popup, then click the Cast option
    await wrapper.find('.rd-btn-output').trigger('click');
    const opt = wrapper.findAll('.rd-output-opt').find((b) => b.text().includes('Living'));
    await opt!.trigger('click');
    expect(setTarget).toHaveBeenCalledWith('cast:uuid-1');
  });

  it('opens the stations manager from the manage button', async () => {
    const { wrapper } = await mountRadio();
    expect(wrapper.find('.mgr-stub').attributes('data-open')).toBe('false');
    await wrapper.find('.rd-manage-btn').trigger('click');
    expect(wrapper.find('.mgr-stub').attributes('data-open')).toBe('true');
  });

  it('toggles the on-screen keyboard for station search', async () => {
    const { wrapper } = await mountRadio();
    expect(wrapper.find('.osk').exists()).toBe(false);
    await wrapper.find('.rd-search-osk').trigger('click');
    expect(wrapper.find('.osk').exists()).toBe(true);
    await wrapper.find('.rd-search-osk').trigger('click');
    expect(wrapper.find('.osk').exists()).toBe(false);
  });
});
