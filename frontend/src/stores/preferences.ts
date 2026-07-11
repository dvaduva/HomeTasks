import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { preferencesApi } from '@/api/preferences';
import type { Preferences } from '@/api/types';
import { setLocale, type Locale } from '@/i18n';

export const usePreferencesStore = defineStore('preferences', () => {
  const data = ref<Preferences | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Feature master switches. Default to enabled until preferences load (and when
  // the field is absent on older payloads) so the features stay backward-compatible.
  const aiEnabled = computed(() => data.value?.ai_enabled !== false);
  const tuyaEnabled = computed(() => data.value?.tuya_enabled !== false);
  const standbyEnabled = computed(() => data.value?.standby_enabled !== false);
  const standbyTimeoutMs = computed(() => {
    const minutes = data.value?.standby_timeout_minutes;
    const safe = typeof minutes === 'number' && minutes > 0 ? minutes : 5;
    return safe * 60_000;
  });

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

  return { data, loading, error, aiEnabled, tuyaEnabled, standbyEnabled, standbyTimeoutMs, fetch, update };
});
