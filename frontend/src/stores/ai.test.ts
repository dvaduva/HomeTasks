import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@/api/ai', () => ({
  aiApi: { chat: vi.fn(), models: vi.fn() },
}));

// Replace the radio store with a spyable fake so dispatchRadioAction is observable.
const radioMock = {
  stations: [{ id: 's1', name: 'ZU' }],
  currentStation: { id: 's1', name: 'ZU' },
  isRemote: false,
  isPlaying: true,
  refreshStations: vi.fn().mockResolvedValue(undefined),
  setTarget: vi.fn(),
  play: vi.fn(),
  stopRemote: vi.fn(),
  togglePlayPause: vi.fn(),
  playNext: vi.fn(),
  playPrev: vi.fn(),
  setVolume: vi.fn(),
};
vi.mock('@/stores/radio', () => ({ useRadioStore: () => radioMock }));

import { aiApi } from '@/api/ai';
import { useAiStore } from './ai';

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  radioMock.stations = [{ id: 's1', name: 'ZU' }];
});

describe('ai store', () => {
  it('send pushes the user message and the AI reply', async () => {
    (aiApi.chat as any).mockResolvedValue({ response: 'Salut!' });
    const store = useAiStore();
    const reply = await store.send('buna');
    expect(reply).toBe('Salut!');
    expect(store.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'buna'],
      ['ai', 'Salut!'],
    ]);
    expect(store.typing).toBe(false);
  });

  it('send forwards the prior turns as history for context', async () => {
    (aiApi.chat as any).mockResolvedValue({ response: 'azi e însorit' });
    const store = useAiStore();
    await store.send('ce vreme e azi?');
    (aiApi.chat as any).mockResolvedValue({ response: 'mâine la fel' });
    await store.send('și mâine?');
    expect((aiApi.chat as any).mock.calls[1][1]).toMatchObject({
      history: [
        { role: 'user', content: 'ce vreme e azi?' },
        { role: 'assistant', content: 'azi e însorit' },
      ],
    });
  });

  it('send records an error and echoes it as an AI message', async () => {
    (aiApi.chat as any).mockRejectedValue(new Error('503 down'));
    const store = useAiStore();
    const reply = await store.send('hi');
    expect(reply).toBe('503 down');
    expect(store.error).toBe('503 down');
    expect(store.messages[1]).toMatchObject({ role: 'ai', text: '503 down' });
  });

  it('send dispatches a radio play action to the radio store', async () => {
    (aiApi.chat as any).mockResolvedValue({
      response: 'Pornesc ZU',
      action_data: { verb: 'play', station_id: 's1', cast_target: 'uuid-1' },
    });
    const store = useAiStore();
    await store.send('pune radio zu');
    // Let the fire-and-forget dispatch settle.
    await Promise.resolve();
    await Promise.resolve();
    expect(radioMock.setTarget).toHaveBeenCalledWith('cast:uuid-1');
    expect(radioMock.play).toHaveBeenCalledWith({ id: 's1', name: 'ZU' });
  });

  it('dispatch volume action forwards the number', async () => {
    (aiApi.chat as any).mockResolvedValue({
      response: '', action_data: { verb: 'volume', volume: 30 },
    });
    const store = useAiStore();
    await store.send('volum 30');
    await Promise.resolve();
    await Promise.resolve();
    expect(radioMock.setVolume).toHaveBeenCalledWith(30);
  });

  it('loadModels stores models, or empties on error', async () => {
    (aiApi.models as any).mockResolvedValue({ models: [{ name: 'llama3' }] });
    const store = useAiStore();
    await store.loadModels();
    expect(store.models).toEqual([{ name: 'llama3' }]);

    (aiApi.models as any).mockRejectedValue(new Error('nope'));
    await store.loadModels();
    expect(store.models).toEqual([]);
    expect(store.error).toBe('nope');
  });

  it('clear empties messages and setOpen toggles the panel', () => {
    const store = useAiStore();
    store.push('user', 'x');
    store.clear();
    expect(store.messages).toEqual([]);
    store.setOpen(true);
    expect(store.open).toBe(true);
  });
});
