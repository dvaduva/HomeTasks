<script setup lang="ts">
import { computed, ref } from 'vue';
import OnScreenKeyboard from './OnScreenKeyboard.vue';

// A text/password/number input with the same touch keyboard affordance the
// Wi-Fi panel uses: a trailing ⌨ button toggles an on-screen keyboard below the
// field (for kiosks/RPi with no hardware keyboard), and password fields also get
// the reveal eye. The OSK works on strings, so number values round-trip through a
// string and are coerced back on the way out (mirrors v-model.number).
const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined;
    type?: 'text' | 'password' | 'number';
    id?: string;
    placeholder?: string;
    min?: number | string;
    max?: number | string;
    step?: number | string;
  }>(),
  { type: 'text' },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
  (e: 'submit'): void;
  (e: 'change'): void;
}>();

const showKeyboard = ref(false);
const reveal = ref(false);

// Always a string for the input and the OSK (OnScreenKeyboard slices the value,
// so it must never receive a raw number).
const text = computed<string>({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (v) => {
    if (props.type === 'number') {
      const n = parseFloat(v);
      emit('update:modelValue', v === '' || Number.isNaN(n) ? v : n);
    } else {
      emit('update:modelValue', v);
    }
  },
});

const inputType = computed(() => {
  if (props.type === 'password') return reveal.value ? 'text' : 'password';
  return props.type;
});

function onSubmit(): void {
  showKeyboard.value = false;
  emit('submit');
}
</script>

<template>
  <div class="kbd-input">
    <div class="kbd-field" :class="{ 'kbd-field-pw': type === 'password' }">
      <input
        :id="id"
        v-model="text"
        :type="inputType"
        :placeholder="placeholder"
        :min="min"
        :max="max"
        :step="step"
        autocomplete="off"
        @keyup.enter="emit('submit')"
        @change="emit('change')"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="kbd-btn"
        :title="reveal ? $t('wifi_password_hide') : $t('wifi_password_show')"
        :aria-pressed="reveal"
        @click="reveal = !reveal"
      >
        {{ reveal ? '🙈' : '👁' }}
      </button>
      <button
        type="button"
        class="kbd-btn kbd-btn-osk"
        :class="{ active: showKeyboard }"
        :title="$t('wifi_keyboard_toggle')"
        :aria-pressed="showKeyboard"
        @click="showKeyboard = !showKeyboard"
      >
        ⌨
      </button>
    </div>
    <OnScreenKeyboard
      v-if="showKeyboard"
      v-model="text"
      @submit="onSubmit"
      @close="showKeyboard = false"
    />
  </div>
</template>

<style scoped>
.kbd-input {
  width: 100%;
  flex: 1 1 auto; /* grow when placed in a flex row (add-user / input-with-btn) */
}
.kbd-field {
  position: relative;
  display: flex;
  align-items: center;
}
.kbd-field input {
  flex: 1;
  width: 100%;
  padding-right: 40px; /* room for the trailing ⌨ button */
}
.kbd-field-pw input {
  padding-right: 76px; /* room for the reveal + ⌨ buttons */
}
.kbd-btn {
  position: absolute;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}
.kbd-btn:hover {
  background: var(--rd-gray-100, #f1f5f9);
}
.kbd-btn.active {
  color: var(--blue, #1d4ed8);
}
.kbd-btn-osk {
  right: 4px;
}
.kbd-field-pw .kbd-btn:not(.kbd-btn-osk) {
  right: 40px;
}
</style>
