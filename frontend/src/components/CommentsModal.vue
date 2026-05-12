<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Task, Comment } from '@/api/types';
import { tasksApi } from '@/api/tasks';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import { formatDate, formatTime } from '@/composables/useDateTime';
import { usePreferencesStore } from '@/stores/preferences';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ open: boolean; task: Task | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'added', taskId: number): void }>();

const users = useUsersStore();
const prefs = usePreferencesStore();
const { error: errorToast } = useNotification();
const { t } = useI18n();

const comments = ref<Comment[]>([]);
const loading = ref(false);
const text = ref('');
const sending = ref(false);
const selectedUserId = ref<number | null>(null);

const dateFormat = computed(() => (prefs.data?.date_format as 'short' | 'long' | 'full') || 'short');
const timeFormat = computed(() => (prefs.data?.time_format as '24' | '12') || '24');

watch(
  () => [props.open, props.task?.id],
  async ([open, id]) => {
    if (!open || !id) {
      comments.value = [];
      text.value = '';
      return;
    }
    loading.value = true;
    try {
      comments.value = await tasksApi.listComments(props.task!.id);
      // Default author = task user, fall back to first active or first user.
      selectedUserId.value =
        props.task!.user_id ||
        users.activeIds[0] ||
        users.items[0]?.id ||
        null;
    } catch (e) {
      errorToast(t('loading_comments_error'));
      console.error(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

async function send(): Promise<void> {
  if (!props.task || !text.value.trim() || !selectedUserId.value) return;
  sending.value = true;
  try {
    const c = await tasksApi.addComment(props.task.id, {
      text: text.value.trim(),
      user_id: selectedUserId.value,
    });
    comments.value = [...comments.value, c];
    text.value = '';
    emit('added', props.task.id);
  } catch (e) {
    errorToast(t('error_comment'));
    console.error(e);
  } finally {
    sending.value = false;
  }
}

function authorName(c: Comment): string {
  return c.user_name || users.byId.get(c.user_id)?.name || `#${c.user_id}`;
}
function authorColor(c: Comment): string {
  return users.byId.get(c.user_id)?.color || '#888';
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ $t('modal_comments_title') }}</h2>
        <button class="icon-btn" @click="emit('close')">✕</button>
      </div>

      <div class="comments-list">
        <p v-if="loading" class="empty">{{ $t('loading') }}</p>
        <p v-else-if="comments.length === 0" class="empty">{{ $t('no_comments') }}</p>
        <div v-for="c in comments" :key="c.id" class="comment">
          <div class="comment-head">
            <span class="comment-author" :style="{ color: authorColor(c) }">{{ authorName(c) }}</span>
            <span class="comment-date">
              {{ c.created_at ? formatDate(c.created_at, dateFormat) + ' ' + formatTime(c.created_at, timeFormat) : '' }}
            </span>
          </div>
          <div class="comment-text">{{ c.text }}</div>
        </div>
      </div>

      <form class="comment-form" @submit.prevent="send">
        <select v-model="selectedUserId" class="comment-user">
          <option v-for="u in users.items" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
        <input v-model="text" type="text" :placeholder="$t('comment_placeholder')" />
        <button class="btn btn-primary" :disabled="sending || !text.trim() || !selectedUserId">
          {{ $t('btn_send') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  width: min(520px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}
.modal-head h2 { margin: 0; font-size: 1.1rem; }
.icon-btn { background: transparent; border: none; cursor: pointer; font-size: 1.2rem; }
.comments-list {
  flex: 1;
  overflow-y: auto;
  max-height: 50vh;
  margin-bottom: 0.75rem;
}
.empty { color: #888; text-align: center; padding: 1rem 0; }
.comment {
  border-bottom: 1px solid #eee;
  padding: 0.5rem 0;
}
.comment-head {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
}
.comment-author { font-weight: 600; }
.comment-date { color: #888; }
.comment-text { white-space: pre-wrap; word-break: break-word; }
.comment-form {
  display: flex;
  gap: 0.4rem;
}
.comment-form input { flex: 1; padding: 0.4rem 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
.comment-user { padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; }
.btn { padding: 0.4rem 0.9rem; border-radius: 4px; border: none; cursor: pointer; }
.btn-primary { background: #1976d2; color: #fff; }
.btn-primary:disabled { background: #aaa; cursor: not-allowed; }
</style>
