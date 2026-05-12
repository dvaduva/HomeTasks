<script setup lang="ts">
import { computed } from 'vue';
import { useUsersStore } from '@/stores/users';
import { useTasksStore } from '@/stores/tasks';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ singleSelect?: boolean }>();
const emit = defineEmits<{ (e: 'add-task'): void }>();

const users = useUsersStore();
const tasks = useTasksStore();
const { t } = useI18n();
const { error: errorToast } = useNotification();

const showAll = computed(() => users.activeIds.length === 0);

function selectAll(): void {
  users.setActiveIds([]);
}

function toggle(id: number): void {
  if (props.singleSelect) {
    users.setActiveIds(users.activeIds.includes(id) ? [] : [id]);
  } else {
    users.toggleActive(id);
  }
}

const countByUser = computed(() => {
  const map = new Map<number, number>();
  for (const t of tasks.today) map.set(t.user_id, (map.get(t.user_id) || 0) + 1);
  return map;
});

async function quickAddUser(): Promise<void> {
  const name = window.prompt(t('prompt_user_name'));
  if (!name || !name.trim()) return;
  try {
    await users.create(name.trim());
  } catch (e) {
    errorToast(e instanceof Error ? e.message : String(e));
  }
}
</script>

<template>
  <div class="user-bar">
    <div class="user-list">
      <button
        type="button"
        class="user-item"
        :class="{ active: showAll }"
        @click="selectAll"
      >
        <span>{{ $t('all_users') }}</span>
      </button>

      <button
        v-for="u in users.items"
        :key="u.id"
        type="button"
        class="user-item"
        :class="{ active: users.activeIds.includes(u.id) }"
        :title="u.name"
        @click="toggle(u.id)"
      >
        <span class="user-color" :style="{ background: u.color || '#888' }"></span>
        <span>{{ u.name }}</span>
        <span v-if="countByUser.get(u.id)" class="user-task-count">{{ countByUser.get(u.id) }}</span>
      </button>

      <button type="button" class="btn-add-user" @click="quickAddUser" :title="$t('btn_add_user')">＋</button>
    </div>

    <button type="button" class="btn-add-task" @click="emit('add-task')" :title="$t('title_new_task')">＋</button>
  </div>
</template>
