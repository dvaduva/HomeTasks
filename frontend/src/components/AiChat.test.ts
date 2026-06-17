import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/ai', () => ({
  aiApi: { chat: vi.fn(), models: vi.fn() },
}));

import { mountWithPlugins } from '@/test/mountWithPlugins';
import AiChat from './AiChat.vue';
import { aiApi } from '@/api/ai';
import { useAiStore } from '@/stores/ai';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiChat.vue', () => {
  it('shows the initial greeting when there are no messages', () => {
    const wrapper = mountWithPlugins(AiChat);
    expect(wrapper.find('.ai-message').exists()).toBe(true);
  });

  it('reflects the open state via the panel class', async () => {
    const wrapper = mountWithPlugins(AiChat);
    const ai = useAiStore();
    ai.setOpen(true);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.chat-panel').classes()).toContain('open');
  });

  it('sends the input and renders user + AI bubbles', async () => {
    (aiApi.chat as any).mockResolvedValue({ response: 'Salut!' });
    const wrapper = mountWithPlugins(AiChat);

    await wrapper.find('#chat-input').setValue('buna');
    await wrapper.find('form').trigger('submit');
    await flush();

    expect(aiApi.chat).toHaveBeenCalled();
    const bubbles = wrapper.findAll('.message p').map((p) => p.text());
    expect(bubbles).toContain('buna');
    expect(bubbles).toContain('Salut!');
    // Input is cleared after sending.
    expect((wrapper.find('#chat-input').element as HTMLInputElement).value).toBe('');
  });

  it('does not send an empty/whitespace message', async () => {
    const wrapper = mountWithPlugins(AiChat);
    await wrapper.find('#chat-input').setValue('   ');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(aiApi.chat).not.toHaveBeenCalled();
  });

  it('closes the panel via the close button', async () => {
    const wrapper = mountWithPlugins(AiChat);
    const ai = useAiStore();
    ai.setOpen(true);
    await wrapper.vm.$nextTick();
    await wrapper.find('.icon-btn').trigger('click');
    expect(ai.open).toBe(false);
  });
});

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
