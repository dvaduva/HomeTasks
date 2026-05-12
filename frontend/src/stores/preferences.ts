import { defineStore } from 'pinia';
import { ref } from 'vue';
import { preferencesApi } from '@/api/preferences';
import type { Preferences } from '@/api/types';
import { setLocale, type Locale } from '@/i18n';

export const usePreferencesStore = defineStore('preferences', () => {
  const data = ref<Preferences | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetch(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      data.value = await preferencesApi.get();
      if (data.value?.language === 'ro' || data.value?.language === 'en') {
        setLocale(data.value.language as Locale);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function update(patch: Partial<Preferences>): Promise<Preferences> {
    const updated = await preferencesApi.update(patch);
    data.value = updated;
    if (patch.language && (patch.language === 'ro' || patch.language === 'en')) {
      setLocale(patch.language as Locale);
    }
    return updated;
  }

  return { data, loading, error, fetch, update };
});
