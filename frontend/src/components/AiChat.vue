<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { useAiStore } from '@/stores/ai';
import { usePreferencesStore } from '@/stores/preferences';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';

const ai = useAiStore();
const prefs = usePreferencesStore();
const { error: errorToast } = useNotification();
const { t } = useI18n();

const input = ref('');
const messagesEl = ref<HTMLElement | null>(null);

async function scrollToEnd(): Promise<void> {
  await nextTick();
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
}

watch(() => ai.messages.length, scrollToEnd);
watch(() => ai.open, async (open) => { if (open) await scrollToEnd(); });

async function send(): Promise<void> {
  const text = input.value.trim();
  if (!text || ai.typing) return;
  input.value = '';
  try {
    await ai.send(text, {
      temperature: prefs.data?.ai_temperature ?? undefined,
      max_tokens: prefs.data?.ai_max_tokens ?? undefined,
    });
  } catch (e) {
    errorToast(e instanceof Error ? e.message : t('ai_connection_error'));
  }
}

function close(): void {
  ai.setOpen(false);
}
</script>

<template>
  <div class="chat-panel" :class="{ open: ai.open }">
    <div class="chat-head">
      <div class="chat-head-info">
        <span class="chat-avatar">AI</span>
        <div>
          <strong>{{ $t('chat_assistant_name') }}</strong>
          <span class="chat-online">{{ $t('chat_online_status') }}</span>
        </div>
      </div>
      <button type="button" class="icon-btn" :title="$t('btn_close')" @click="close">✕</button>
    </div>

    <div class="chat-messages" ref="messagesEl">
      <div v-if="ai.messages.length === 0" class="message ai-message">
        <p>{{ $t('chat_initial_msg') }}</p>
      </div>
      <div
        v-for="m in ai.messages"
        :key="m.id"
        class="message"
        :class="m.role === 'user' ? 'user-message' : 'ai-message'"
      >
        <p>{{ m.text }}</p>
      </div>
      <div v-if="ai.typing" class="message typing-indicator">
        <div class="ai-message"><p>{{ $t('ai_typing') }}</p></div>
      </div>
    </div>

    <div class="chat-input-wrap">
      <form @submit.prevent="send">
        <input id="chat-input" v-model="input" type="text" :placeholder="$t('chat_placeholder')" autocomplete="off" />
        <button type="submit" class="btn-send" :title="$t('chat_send_title')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  </div>
</template>
