import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tuyaApi, type TuyaDevice, type TuyaTemperatures } from '@/api/tuya';

export const useTuyaStore = defineStore('tuya', () => {
  const devices = ref<TuyaDevice[]>([]);
  const updatedAt = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function applyPayload(payload: TuyaTemperatures): void {
    devices.value = payload.devices || [];
    updatedAt.value = payload.updated_at || null;
  }

  async function fetch(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await tuyaApi.temperatures();
      applyPayload(data);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await tuyaApi.refresh();
      applyPayload(data);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { devices, updatedAt, loading, error, fetch, refresh };
});
