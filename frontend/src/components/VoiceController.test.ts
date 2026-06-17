import { beforeEach, describe, expect, it, vi } from 'vitest';

// In jsdom there's no SpeechRecognition, so SRCtor is undefined — the component
// falls back to the server-mic path, which is what we exercise here.
const errorToast = vi.fn();
const toast = vi.fn();
vi.mock('@/composables/useNotification', () => ({
  useNotification: () => ({ error: errorToast, toast }),
}));

const aiSend = vi.fn().mockResolvedValue('ok');
const aiSetOpen = vi.fn();
vi.mock('@/stores/ai', () => ({ useAiStore: () => ({ send: aiSend, setOpen: aiSetOpen }) }));

vi.mock('@/api/voice', () => ({
  voiceApi: { serverAvailable: vi.fn(), listen: vi.fn() },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import VoiceController from './VoiceController.vue';
import { voiceApi } from '@/api/voice';

beforeEach(() => {
  vi.clearAllMocks();
});

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

describe('VoiceController.vue', () => {
  it('marks itself unavailable when neither browser SR nor server mic exist', async () => {
    (voiceApi.serverAvailable as any).mockResolvedValue({ available: false, tts_available: false });
    const wrapper = mountWithPlugins(VoiceController);
    await flush();
    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.status-text').text()).toBe('Microfon: indisponibil'); // mic_unavailable (ro)
  });

  it('uses the server mic: listens then forwards the text to the AI', async () => {
    (voiceApi.serverAvailable as any).mockResolvedValue({ available: true, tts_available: true });
    (voiceApi.listen as any).mockResolvedValue({ text: 'pune radio zu', error: null });
    const wrapper = mountWithPlugins(VoiceController);
    await flush();

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined();
    await wrapper.find('button').trigger('click');
    await flush();

    expect(voiceApi.listen).toHaveBeenCalled();
    expect(aiSetOpen).toHaveBeenCalledWith(true);
    expect(aiSend).toHaveBeenCalledWith('pune radio zu');
  });

  it('surfaces a server listen error', async () => {
    (voiceApi.serverAvailable as any).mockResolvedValue({ available: true, tts_available: false });
    (voiceApi.listen as any).mockResolvedValue({ text: null, error: 'Mic busy' });
    const wrapper = mountWithPlugins(VoiceController);
    await flush();
    await wrapper.find('button').trigger('click');
    await flush();
    expect(errorToast).toHaveBeenCalledWith('Mic busy');
    expect(aiSend).not.toHaveBeenCalled();
  });

  it('shows the default available status when server mic is present', async () => {
    (voiceApi.serverAvailable as any).mockResolvedValue({ available: true, tts_available: false });
    const wrapper = mountWithPlugins(VoiceController);
    await flush();
    // Not the unavailable label.
    expect(wrapper.find('.status-text').text()).not.toBe('Microfon: indisponibil');
  });
});
