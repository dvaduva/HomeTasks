import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountWithPlugins } from '@/test/mountWithPlugins';
import RadioMiniPlayer from './RadioMiniPlayer.vue';
import { useRadioStore } from '@/stores/radio';

// Stub RouterLink so we don't need a full router instance.
const stubs = { RouterLink: { template: '<a><slot /></a>' } };

beforeEach(() => {
  localStorage.clear();
  // The store creates an <audio> element lazily; stub it to be safe.
  vi.stubGlobal('Audio', class {
    addEventListener() {}
    play() { return Promise.resolve(); }
    pause() {}
  } as any);
});

function mountMini() {
  return mountWithPlugins(RadioMiniPlayer, { global: { stubs } });
}

describe('RadioMiniPlayer.vue', () => {
  it('shows the current station name and now-playing track', async () => {
    const wrapper = mountMini();
    const radio = useRadioStore();
    radio.stations = [{ id: 's1', name: 'Radio ZU', url: 'http://x' }] as any;
    radio.currentId = 's1';
    radio.npTrack = 'Artist - Song';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.rd-mini-name').text()).toBe('Radio ZU');
    expect(wrapper.find('.rd-mini-track').text()).toBe('Artist - Song');
  });

  it('derives initials when the station has no logo', async () => {
    const wrapper = mountMini();
    const radio = useRadioStore();
    radio.stations = [{ id: 's1', name: 'Rock FM', url: 'http://x' }] as any;
    radio.currentId = 's1';
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.rd-mini-logo span').text()).toBe('RF'); // first letters, uppercased
  });

  it('reflects the playing state via a class', async () => {
    const wrapper = mountMini();
    const radio = useRadioStore();
    radio.isPlaying = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.rd-mini').classes()).toContain('playing');
  });

  it('the play button calls togglePlayPause', async () => {
    const wrapper = mountMini();
    const radio = useRadioStore();
    const toggle = vi.spyOn(radio, 'togglePlayPause').mockImplementation(() => {});
    await wrapper.find('.rd-mini-play').trigger('click');
    expect(toggle).toHaveBeenCalled();
  });

  it('the close button calls dismissMini', async () => {
    const wrapper = mountMini();
    const radio = useRadioStore();
    const dismiss = vi.spyOn(radio, 'dismissMini').mockImplementation(() => {});
    await wrapper.find('.rd-mini-close').trigger('click');
    expect(dismiss).toHaveBeenCalled();
  });
});
