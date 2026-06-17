import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';

vi.mock('@/api/transport', () => ({ transportApi: { routes: vi.fn(), chat: vi.fn() } }));
vi.mock('@/api/voice', () => ({
  voiceApi: {
    serverAvailable: vi.fn().mockResolvedValue({ available: false, tts_available: false }),
    listen: vi.fn(),
    speakUrl: () => '/api/voice/speak',
  },
}));
vi.mock('@/api/preferences', () => ({
  preferencesApi: { get: vi.fn().mockResolvedValue({ voice_language: 'ro-RO' }) },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import TransportView from './TransportView.vue';
import { transportApi } from '@/api/transport';

const ROUTE = {
  route: '101',
  direction: 'Centru -> Gara',
  stations_order: ['Centru', 'Piata', 'Gara'],
  // Only "Centru" has a schedule; the others render as no-data.
  departures: {
    Centru: { Lucru: { plecari: { '8': ['00', '30'], '9': ['15'] } } },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (transportApi.routes as any).mockResolvedValue([ROUTE]);
  (transportApi.chat as any).mockResolvedValue({ response: 'Următorul la 09:15.' });
});

async function flush() {
  await flushPromises();
  await flushPromises();
}

describe('TransportView.vue', () => {
  it('loads routes and lists the stations', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    expect(transportApi.routes).toHaveBeenCalled();
    expect(wrapper.find('.tp-route-num').text()).toBe('101');
    expect(wrapper.findAll('.tp-station-item')).toHaveLength(3);
  });

  it('shows the placeholder until a station is picked', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    expect(wrapper.find('.tp-placeholder').exists()).toBe(true);
  });

  it('selecting a station with data shows its schedule', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    await wrapper.findAll('.tp-station-item')[0].trigger('click'); // Centru
    await flush();
    expect(wrapper.find('.tp-station-header-name').text()).toBe('Centru');
    // 3 departures total → "3 curse" and a schedule table.
    expect(wrapper.find('.tp-schedule-header').text()).toContain('3 curse');
    expect(wrapper.find('.tp-schedule-table').exists()).toBe(true);
  });

  it('marks stations without data as no-data and ignores their clicks', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    const piata = wrapper.findAll('.tp-station-item')[1]; // Piata, no schedule
    expect(piata.classes()).toContain('no-data');
    await piata.trigger('click');
    await flush();
    expect(wrapper.find('.tp-placeholder').exists()).toBe(true); // nothing selected
  });

  it('switches the day type', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    const dayBtns = wrapper.findAll('.tp-day-btn');
    await dayBtns[1].trigger('click'); // Sâmbătă
    expect(dayBtns[1].classes()).toContain('active');
  });

  it('toggles the route picker modal', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    await wrapper.find('.tp-route-current').trigger('click');
    expect(wrapper.find('.tp-route-modal').exists()).toBe(true);
  });

  it('opens the AI panel and sends a message to the chat endpoint', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    await wrapper.find('.tp-ai-toggle').trigger('click');
    expect(wrapper.find('.tp-ai-panel').classes()).toContain('open');

    await wrapper.find('.tp-ai-input').setValue('Când vine?');
    await wrapper.find('.tp-ai-send').trigger('click');
    await flush();

    expect(transportApi.chat).toHaveBeenCalled();
    const bubbles = wrapper.findAll('.tp-ai-bubble').map((b) => b.text());
    expect(bubbles).toContain('Când vine?');
    expect(bubbles).toContain('Următorul la 09:15.');
  });

  it('shows an error when route loading fails', async () => {
    (transportApi.routes as any).mockRejectedValue(new Error('offline'));
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    expect(wrapper.find('.tp-error').text()).toContain('offline');
  });

  it('disables the voice button when no mic is available', async () => {
    const wrapper = mountWithPlugins(TransportView);
    await flush();
    // No browser SR in jsdom and serverAvailable=false → disabled.
    expect(wrapper.find('.tp-voice-btn').attributes('disabled')).toBeDefined();
  });
});
