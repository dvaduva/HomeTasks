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
    updatedAt.value = payload.generated_at || null;
  }

  async function fetch(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await tuyaApi.temperatures();
      applyPayload(data);
      if (data.error) error.value = data.error;
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
      // /api/tuya/refresh pulls fresh data from the Tuya cloud and returns
      // {success, device_count} — not the temperatures — so re-read after.
      const res = await tuyaApi.refresh();
      if (res.error) error.value = res.error;
      const data = await tuyaApi.temperatures();
      applyPayload(data);
      if (data.error) error.value = data.error;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { devices, updatedAt, loading, error, fetch, refresh };
});
