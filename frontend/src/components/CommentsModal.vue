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
      selectedUserId.value = props.task!.user_id || users.activeIds[0] || users.items[0]?.id || null;
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
  <div v-if="open" class="modal-overlay active" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-head">
        <h2>{{ $t('modal_comments_title') }}</h2>
        <button type="button" class="icon-btn" :title="$t('btn_close')" @click="emit('close')">✕</button>
      </div>

      <div class="tab-content active comments-modal-content" style="display:flex;">
        <div class="comments-list">
          <p v-if="loading" class="comments-loading">{{ $t('loading') }}</p>
          <p v-else-if="comments.length === 0" class="comments-empty">{{ $t('no_comments') }}</p>
          <div v-for="c in comments" :key="c.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author-dot" :style="{ background: authorColor(c) }"></span>
              <span class="comment-author">{{ authorName(c) }}</span>
              <span class="comment-date">
                {{ c.created_at ? formatDate(c.created_at, dateFormat) + ' ' + formatTime(c.created_at, timeFormat) : '' }}
              </span>
            </div>
            <p class="comment-text">{{ c.text }}</p>
          </div>
        </div>

        <form class="add-comment-form" @submit.prevent="send">
          <select v-model="selectedUserId" class="comment-user-select">
            <option v-for="u in users.items" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
          <textarea v-model="text" :placeholder="$t('comment_placeholder')" rows="2"></textarea>
          <div class="add-comment-actions">
            <button type="button" class="btn btn-secondary" @click="emit('close')">{{ $t('btn_close') }}</button>
            <button type="submit" class="btn btn-primary" :disabled="sending || !text.trim() || !selectedUserId">
              {{ $t('btn_send') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
