<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale, type Locale } from '@/i18n';

const { locale } = useI18n();

const isRo = computed(() => locale.value === 'ro');

function switchLocale(): void {
  const next: Locale = isRo.value ? 'en' : 'ro';
  setLocale(next);
}
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <h1>HomeTasks</h1>
      <nav>
        <RouterLink to="/">{{ $t('col_today') }}</RouterLink>
        <a href="/calendar">Calendar</a>
        <a href="/radio">Radio</a>
        <a href="/transport">Transport</a>
        <a href="/history">{{ $t('history_btn_label') }}</a>
        <button class="lang-toggle" @click="switchLocale">{{ isRo ? 'EN' : 'RO' }}</button>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
:root {
  --header-bg: #2c3e50;
  --header-fg: #fff;
}
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: #fafafa;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--header-bg);
  color: var(--header-fg);
}
.app-header h1 {
  margin: 0;
  font-size: 1.25rem;
}
.app-header nav {
  display: flex;
  gap: 1rem;
  align-items: center;
}
.app-header a {
  color: var(--header-fg);
  text-decoration: none;
}
.app-header a:hover {
  text-decoration: underline;
}
.lang-toggle {
  background: transparent;
  color: var(--header-fg);
  border: 1px solid currentColor;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}
</style>
