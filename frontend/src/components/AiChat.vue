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
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

watch(() => ai.messages.length, scrollToEnd);
watch(() => ai.open, async (open) => {
  if (open) await scrollToEnd();
});

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
      <button class="icon-btn" @click="close">✕</button>
    </div>

    <div class="chat-messages" ref="messagesEl">
      <div v-if="ai.messages.length === 0" class="message ai-message">
        <p>{{ $t('chat_initial_msg') }}</p>
      </div>
      <div v-for="m in ai.messages" :key="m.id" class="message" :class="m.role === 'user' ? 'user-message' : 'ai-message'">
        <p>{{ m.text }}</p>
      </div>
      <div v-if="ai.typing" class="message ai-message typing">
        <p>{{ $t('ai_typing') }}</p>
      </div>
    </div>

    <form class="chat-input-wrap" @submit.prevent="send">
      <input v-model="input" type="text" :placeholder="$t('chat_placeholder')" autocomplete="off" />
      <button type="submit" class="btn-send" :title="$t('chat_send_title')">➤</button>
    </form>
  </div>
</template>

<style scoped>
.chat-panel {
  position: fixed;
  bottom: 70px;
  right: 1rem;
  width: 360px;
  max-width: calc(100vw - 2rem);
  height: 480px;
  max-height: calc(100vh - 120px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: none;
  flex-direction: column;
  z-index: 50;
}
.chat-panel.open { display: flex; }
.chat-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.85rem;
  background: #1976d2;
  color: #fff;
  border-radius: 10px 10px 0 0;
}
.chat-head-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.chat-head-info strong {
  display: block;
}
.chat-online {
  font-size: 0.7rem;
  opacity: 0.85;
}
.chat-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.icon-btn {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 1.1rem;
}
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem;
  background: #fafafa;
}
.message {
  margin: 0.3rem 0;
  padding: 0.5rem 0.7rem;
  border-radius: 14px;
  max-width: 80%;
  font-size: 0.9rem;
  word-break: break-word;
}
.message p { margin: 0; }
.user-message {
  background: #1976d2;
  color: #fff;
  margin-left: auto;
}
.ai-message {
  background: #eceff1;
  color: #222;
}
.typing {
  opacity: 0.75;
  font-style: italic;
}
.chat-input-wrap {
  display: flex;
  gap: 0.3rem;
  padding: 0.5rem;
  border-top: 1px solid #eee;
}
.chat-input-wrap input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 999px;
}
.btn-send {
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  cursor: pointer;
}
</style>
