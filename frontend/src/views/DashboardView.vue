<script setup lang="ts">
import { onMounted } from 'vue';
import { useUsersStore } from '@/stores/users';
import { usePreferencesStore } from '@/stores/preferences';
import { useTasksStore } from '@/stores/tasks';

const users = useUsersStore();
const prefs = usePreferencesStore();
const tasks = useTasksStore();

onMounted(async () => {
  // Eager-load core data so the dashboard has users/prefs ready.
  await Promise.allSettled([users.fetchAll(), prefs.fetch(), tasks.fetchToday()]);
});
</script>

<template>
  <section class="dashboard-placeholder">
    <h2>{{ $t('col_today') }}</h2>
    <p v-if="users.loading || prefs.loading">{{ $t('loading') }}</p>
    <p v-else-if="users.error">{{ $t('error_prefix') }}{{ users.error }}</p>
    <p v-else>
      Infrastructură SPA pornită — {{ users.items.length }} utilizatori, {{ tasks.today.length }} taskuri azi.
    </p>
    <p class="hint">
      Dashboard-ul complet va fi portat în Faza 2. Momentan paginile Flask
      (<code>/</code> MPA, <code>/calendar</code>, <code>/radio</code>, <code>/transport</code>, <code>/history</code>)
      rămân funcționale.
    </p>
  </section>
</template>

<style scoped>
.dashboard-placeholder {
  padding: 2rem;
  font-family: system-ui, sans-serif;
}
.hint {
  margin-top: 1rem;
  color: #666;
  font-size: 0.9rem;
}
code {
  background: #f4f4f4;
  padding: 0 0.25rem;
  border-radius: 3px;
}
</style>
