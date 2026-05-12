<script setup lang="ts">
import { computed } from 'vue';
import type { Task } from '@/api/types';
import TaskCard from './TaskCard.vue';

const props = defineProps<{
  tasks: Task[];
  loading?: boolean;
  emptyKey?: string;
  filterUserIds?: number[];
}>();

const emit = defineEmits<{
  (e: 'edit', t: Task): void;
  (e: 'comments', t: Task): void;
}>();

const filtered = computed(() => {
  if (!props.filterUserIds || props.filterUserIds.length === 0) return props.tasks;
  const set = new Set(props.filterUserIds);
  return props.tasks.filter((t) => set.has(t.user_id));
});

const emptyKey = computed(() => props.emptyKey || 'no_tasks');
</script>

<template>
  <div class="task-list">
    <p v-if="loading" class="empty">{{ $t('loading') }}</p>
    <p v-else-if="filtered.length === 0" class="empty">{{ $t(emptyKey) }}</p>
    <TaskCard
      v-for="t in filtered"
      :key="t.id"
      :task="t"
      @edit="emit('edit', $event)"
      @comments="emit('comments', $event)"
    />
  </div>
</template>

<style scoped>
.task-list {
  padding: 0.5rem;
  overflow-y: auto;
  height: 100%;
}
.empty {
  text-align: center;
  color: #777;
  font-style: italic;
  padding: 1rem 0;
}
</style>
