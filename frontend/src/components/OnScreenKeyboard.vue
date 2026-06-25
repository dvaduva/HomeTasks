<script setup lang="ts">
import { ref } from 'vue';

// Touch-friendly on-screen keyboard for kiosk/RPi use, where no physical
// keyboard is attached. Drives a text field via v-model and exposes submit/close
// so the host can wire Enter and the dismiss button. Layout toggles between
// letters and symbols, with a sticky Shift for uppercase.
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'submit'): void;
  (e: 'close'): void;
}>();

const shift = ref(false);
const symbols = ref(false);

const letterRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const symbolRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', '_', '=', '+', '[', ']', '{', '}'],
  [';', ':', "'", '"', '/', '?', '.', ','],
];

function keyLabel(key: string): string {
  return shift.value && !symbols.value ? key.toUpperCase() : key;
}

function press(key: string): void {
  emit('update:modelValue', props.modelValue + keyLabel(key));
}

function backspace(): void {
  emit('update:modelValue', props.modelValue.slice(0, -1));
}

function space(): void {
  emit('update:modelValue', props.modelValue + ' ');
}
</script>

<template>
  <div class="osk" role="group" :aria-label="$t('osk_label')">
    <div v-for="(row, i) in symbols ? symbolRows : letterRows" :key="i" class="osk-row">
      <button v-for="key in row" :key="key" type="button" class="osk-key" @click="press(key)">
        {{ keyLabel(key) }}
      </button>
    </div>

    <div class="osk-row osk-row-actions">
      <button
        v-if="!symbols"
        type="button"
        class="osk-key osk-key-mod"
        :class="{ active: shift }"
        :aria-pressed="shift"
        :title="$t('osk_shift')"
        @click="shift = !shift"
      >
        ⇧
      </button>
      <button
        type="button"
        class="osk-key osk-key-mod"
        :class="{ active: symbols }"
        :aria-pressed="symbols"
        @click="symbols = !symbols"
      >
        {{ symbols ? 'ABC' : '?123' }}
      </button>
      <button type="button" class="osk-key osk-key-space" @click="space">
        {{ $t('osk_space') }}
      </button>
      <button type="button" class="osk-key osk-key-mod" :title="$t('osk_backspace')" @click="backspace">
        ⌫
      </button>
      <button type="button" class="osk-key osk-key-enter" :title="$t('osk_enter')" @click="emit('submit')">
        ⏎
      </button>
      <button type="button" class="osk-key osk-key-mod" :title="$t('osk_close')" @click="emit('close')">
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.osk {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  margin-top: 8px;
  border: 1px solid var(--rd-gray-200, #e2e8f0);
  border-radius: 12px;
  background: var(--rd-gray-100, #f1f5f9);
  user-select: none;
}
.osk-row {
  display: flex;
  justify-content: center;
  gap: 6px;
}
.osk-key {
  flex: 1 1 0;
  min-width: 0;
  min-height: 44px;
  padding: 0 4px;
  border: 1px solid var(--rd-gray-200, #e2e8f0);
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 16px;
  cursor: pointer;
}
.osk-key:hover {
  background: var(--rd-gray-100, #f1f5f9);
}
.osk-key:active {
  background: var(--rd-gray-200, #e2e8f0);
}
.osk-key-mod {
  flex: 0 0 auto;
  min-width: 52px;
  font-size: 18px;
}
.osk-key-mod.active {
  background: var(--blue, #1d4ed8);
  color: #fff;
  border-color: var(--blue, #1d4ed8);
}
.osk-key-space {
  flex: 1 1 auto;
  min-width: 120px;
}
.osk-key-enter {
  flex: 0 0 auto;
  min-width: 52px;
  font-size: 18px;
  background: var(--blue, #1d4ed8);
  color: #fff;
  border-color: var(--blue, #1d4ed8);
}
.osk-key-enter:hover {
  filter: brightness(0.95);
}
</style>
