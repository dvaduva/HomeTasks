<script setup lang="ts">
import { computed } from 'vue';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ singleSelect?: boolean }>();
const emit = defineEmits<{ (e: 'add-task'): void }>();

const users = useUsersStore();
const { t } = useI18n();
const { error: errorToast } = useNotification();

const showAll = computed({
  get: () => users.activeIds.length === 0,
  set: (v: boolean) => {
    if (v) users.setActiveIds([]);
  },
});

function toggle(id: number): void {
  if (props.singleSelect) {
    users.setActiveIds(users.activeIds.includes(id) ? [] : [id]);
  } else {
    users.toggleActive(id);
  }
}

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
        class="user-chip user-chip-all"
        :class="{ active: showAll }"
        @click="showAll = true"
      >
        {{ $t('all_users') }}
      </button>

      <button
        v-for="u in users.items"
        :key="u.id"
        type="button"
        class="user-chip"
        :class="{ active: users.activeIds.includes(u.id) }"
        :style="{ '--user-color': u.color || '#888' }"
        :title="u.name"
        @click="toggle(u.id)"
      >
        <span class="user-dot" :style="{ background: u.color || '#888' }"></span>
        <span class="user-name">{{ u.name }}</span>
      </button>

      <button type="button" class="user-chip user-chip-quick-add" @click="quickAddUser" :title="$t('btn_add_user')">＋</button>
    </div>

    <button type="button" class="btn-add-task" @click="emit('add-task')" :title="$t('title_new_task')">＋</button>
  </div>
</template>

<style scoped>
.user-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.user-list {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: #f0f0f0;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
}
.user-chip:hover {
  background: #e5e5e5;
}
.user-chip.active {
  background: var(--user-color, #1976d2);
  color: #fff;
  border-color: var(--user-color, #1976d2);
}
.user-chip-all.active {
  background: #333;
  color: #fff;
}
.user-chip-quick-add {
  font-weight: bold;
  background: #e8f5e9;
}
.user-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.user-chip.active .user-dot {
  background: #fff !important;
}
.btn-add-task {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #1976d2;
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-add-task:hover {
  background: #1565c0;
}
</style>
