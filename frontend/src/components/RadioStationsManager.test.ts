import { beforeEach, describe, expect, it, vi } from 'vitest';

const success = vi.fn();
const errorToast = vi.fn();
const confirmMock = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ success, error: errorToast, confirm: confirmMock }),
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import RadioStationsManager from './RadioStationsManager.vue';
import { useRadioStore } from '@/stores/radio';

const STATIONS = [
  { id: 'zu', name: 'Radio ZU', url: 'http://zu', genre: 'Pop', proxy: false },
  { id: 'rock', name: 'Rock FM', url: 'http://rock', genre: 'Rock', proxy: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  // The radio store lazily builds an <audio>; stub it just in case.
  vi.stubGlobal('Audio', class { addEventListener() {} play() { return Promise.resolve(); } pause() {} } as any);
});

function mountMgr() {
  const wrapper = mountWithPlugins(RadioStationsManager, { props: { open: true } });
  const radio = useRadioStore();
  radio.stations = [...STATIONS] as any;
  return { wrapper, radio };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('RadioStationsManager.vue', () => {
  it('renders nothing when closed', () => {
    const wrapper = mountWithPlugins(RadioStationsManager, { props: { open: false } });
    expect(wrapper.find('.modal-overlay').exists()).toBe(false);
  });

  it('lists the stations and marks proxy ones with a badge', async () => {
    const { wrapper } = mountMgr();
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('.rd-mgr-row')).toHaveLength(2);
    expect(wrapper.find('.rd-mgr-badge').exists()).toBe(true); // Rock FM has proxy
  });

  it('filters the list by the search query', async () => {
    const { wrapper } = mountMgr();
    await wrapper.vm.$nextTick();
    await wrapper.find('.rd-mgr-search input').setValue('rock');
    expect(wrapper.findAll('.rd-mgr-row')).toHaveLength(1);
    expect(wrapper.find('.rd-mgr-name').text()).toContain('Rock FM');
  });

  it('opens the add form and validates an empty name', async () => {
    const { wrapper, radio } = mountMgr();
    const create = vi.spyOn(radio, 'createStation');
    await wrapper.vm.$nextTick();
    await wrapper.find('.rd-mgr-toolbar .btn-primary').trigger('click'); // startAdd
    expect(wrapper.find('.rd-mgr-form').exists()).toBe(true);
    await wrapper.find('.rd-mgr-form-actions .btn-primary').trigger('click'); // saveForm, blank
    expect(errorToast).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a station from the add form', async () => {
    const { wrapper, radio } = mountMgr();
    const create = vi.spyOn(radio, 'createStation').mockResolvedValue({ id: 'new' } as any);
    await wrapper.vm.$nextTick();
    await wrapper.find('.rd-mgr-toolbar .btn-primary').trigger('click');
    await wrapper.findAll('.rd-mgr-form input[type="text"]')[0].setValue('New Radio'); // name
    await wrapper.findAll('.rd-mgr-form input[type="text"]')[2].setValue('http://new'); // url
    await wrapper.find('.rd-mgr-form-actions .btn-primary').trigger('click');
    await flush();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Radio', url: 'http://new' }));
    expect(success).toHaveBeenCalled();
  });

  it('prefills the edit form and updates', async () => {
    const { wrapper, radio } = mountMgr();
    const update = vi.spyOn(radio, 'updateStation').mockResolvedValue(undefined);
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.rd-mgr-row')[0].find('.btn-secondary').trigger('click'); // startEdit ZU
    expect((wrapper.find('.rd-mgr-form input[type="text"]').element as HTMLInputElement).value).toBe('Radio ZU');
    await wrapper.find('.rd-mgr-form-actions .btn-primary').trigger('click');
    await flush();
    expect(update).toHaveBeenCalledWith('zu', expect.objectContaining({ name: 'Radio ZU' }));
  });

  it('deletes a station after confirmation', async () => {
    confirmMock.mockResolvedValue(true);
    const { wrapper, radio } = mountMgr();
    const del = vi.spyOn(radio, 'deleteStation').mockResolvedValue(undefined);
    await wrapper.vm.$nextTick();
    await wrapper.findAll('.rd-mgr-row')[0].find('.btn-danger').trigger('click');
    await flush();
    expect(confirmMock).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith('zu');
  });

  it('reorders via the arrow buttons', async () => {
    const { wrapper, radio } = mountMgr();
    const reorder = vi.spyOn(radio, 'reorderStations').mockResolvedValue(undefined);
    await wrapper.vm.$nextTick();
    // Second row's "up" arrow moves Rock FM above Radio ZU.
    await wrapper.findAll('.rd-mgr-row')[1].find('.rd-mgr-arrow').trigger('click');
    await flush();
    expect(reorder).toHaveBeenCalledWith(['rock', 'zu']);
  });
});
