<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRadioStore } from '@/stores/radio';
import '@/assets/css/radio-mini.css';

// Floating, draggable radio widget mounted in App.vue. It's a thin UI over the
// radio store — App.vue decides when to show it (off the /radio route, while a
// station is selected and the user hasn't dismissed it).

const POS_KEY = 'rd-mini-pos';

const radio = useRadioStore();

function initials(name: string): string {
  return (name || '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

// ── drag ───────────────────────────────────────────────────────────────────
const el = ref<HTMLElement | null>(null);
const dragging = ref(false);

let startX = 0;
let startY = 0;
let origLeft = 0;
let origTop = 0;
let moved = false;

function clampToViewport(left: number, top: number, rect: DOMRect): { left: number; top: number } {
  const maxLeft = window.innerWidth - rect.width - 4;
  const maxTop = window.innerHeight - rect.height - 4;
  return {
    left: Math.max(4, Math.min(left, maxLeft)),
    top: Math.max(4, Math.min(top, maxTop)),
  };
}

function applySavedPosition(): void {
  const wrap = el.value;
  if (!wrap) return;
  const saved = localStorage.getItem(POS_KEY);
  if (!saved) return;
  try {
    const { left, top } = JSON.parse(saved);
    const rect = wrap.getBoundingClientRect();
    const clamped = clampToViewport(left, top, rect);
    wrap.style.left = `${clamped.left}px`;
    wrap.style.top = `${clamped.top}px`;
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  } catch {
    /* ignore malformed position */
  }
}

function onPointerDown(e: PointerEvent): void {
  const wrap = el.value;
  if (!wrap || (e.button !== undefined && e.button !== 0)) return;
  const rect = wrap.getBoundingClientRect();
  origLeft = rect.left;
  origTop = rect.top;
  startX = e.clientX;
  startY = e.clientY;
  dragging.value = true;
  moved = false;
  wrap.style.left = `${origLeft}px`;
  wrap.style.top = `${origTop}px`;
  wrap.style.right = 'auto';
  wrap.style.bottom = 'auto';
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onPointerMove(e: PointerEvent): void {
  const wrap = el.value;
  if (!dragging.value || !wrap) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
  const rect = wrap.getBoundingClientRect();
  const clamped = clampToViewport(origLeft + dx, origTop + dy, rect);
  wrap.style.left = `${clamped.left}px`;
  wrap.style.top = `${clamped.top}px`;
}

function onPointerUp(e: PointerEvent): void {
  const wrap = el.value;
  if (!dragging.value || !wrap) return;
  dragging.value = false;
  const handle = e.target as HTMLElement;
  if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  if (moved) {
    const rect = wrap.getBoundingClientRect();
    localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
  }
}

onMounted(() => {
  applySavedPosition();
  window.addEventListener('resize', applySavedPosition);
});
</script>

<template>
  <div ref="el" class="rd-mini" :class="{ playing: radio.isPlaying, dragging }">
    <div
      class="rd-mini-drag"
      title="Trage pentru a muta"
      aria-label="Trage pentru a muta"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="3" r="1.2"/><circle cx="7.5" cy="3" r="1.2"/><circle cx="2.5" cy="8" r="1.2"/><circle cx="7.5" cy="8" r="1.2"/><circle cx="2.5" cy="13" r="1.2"/><circle cx="7.5" cy="13" r="1.2"/></svg>
    </div>

    <RouterLink class="rd-mini-link" to="/radio" title="Deschide pagina Radio">
      <div class="rd-mini-logo">
        <img
          v-if="radio.currentStation && radio.currentStation.logo"
          :src="radio.currentStation.logo"
          alt=""
        >
        <span v-else>{{ initials(radio.currentStation ? radio.currentStation.name : '') }}</span>
      </div>
      <div class="rd-mini-text">
        <div class="rd-mini-name">{{ radio.currentStation ? radio.currentStation.name : '' }}</div>
        <div class="rd-mini-track">{{ radio.npTrack }}</div>
      </div>
    </RouterLink>

    <button
      type="button"
      class="rd-mini-btn rd-mini-play"
      aria-label="Play/Pauză"
      title="Play/Pauză"
      @click="radio.togglePlayPause()"
    >
      <svg class="rd-mini-icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <svg class="rd-mini-icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </button>

    <button
      type="button"
      class="rd-mini-btn rd-mini-close"
      aria-label="Închide widget"
      title="Ascunde"
      @click="radio.dismissMini()"
    >
      ✕
    </button>
  </div>
</template>
