<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { transportApi } from '@/api/transport';
import type { TransportRoute } from '@/api/transport';
import { voiceApi } from '@/api/voice';
import { usePreferencesStore } from '@/stores/preferences';
import { useVoiceTargetStore } from '@/stores/voiceTarget';
import { useNow } from '@/composables/useDateTime';
import '@/assets/css/transport.css';

type DayType = 'Lucru' | 'Sambata' | 'Duminica';

const DAY_BADGE_LABELS: Record<DayType, string> = {
  Lucru: 'Zi Lucrătoare',
  Sambata: 'Sâmbătă',
  Duminica: 'Duminică',
};

const prefs = usePreferencesStore();
const voiceTarget = useVoiceTargetStore();
const now = useNow(1000);

// ── State ────────────────────────────────────────────────────────────────────
const routes = ref<TransportRoute[]>([]);
const loadError = ref<string>('');
const activeRouteIdx = ref(0);
const activeStation = ref<string | null>(null);
const dayType = ref<DayType>(getDayType());
const aiOpen = ref(false);
const routePickerOpen = ref(false);

const scheduleScrollEl = ref<HTMLElement | null>(null);
const aiInputEl = ref<HTMLInputElement | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDayType(): DayType {
  const d = new Date().getDay();
  if (d === 0) return 'Duminica';
  if (d === 6) return 'Sambata';
  return 'Lucru';
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function formatCurrentDate(): string {
  const d = new Date();
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}
function nowMinutes(): number {
  const n = now.value;
  return n.getHours() * 60 + n.getMinutes();
}
function formatCountdown(diffMin: number): string {
  if (diffMin <= 0) return 'acum';
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface BusTime {
  hour: number;
  minute: number;
  totalMin: number;
  label: string;
  dest: string;
}

function getStationTimes(
  stationEntry: Record<string, unknown>,
  day: DayType,
): BusTime[] {
  const sched = (stationEntry[day] || stationEntry['Lucru'] || {}) as Record<string, unknown>;
  const times: BusTime[] = [];

  for (const [key, val] of Object.entries(sched)) {
    if (key === 'first_checkpoint' || key === 'second_checkpoint') continue;
    const hourMap = val;
    if (typeof hourMap !== 'object' || hourMap === null || Array.isArray(hourMap)) continue;

    for (const [hour, mins] of Object.entries(hourMap as Record<string, string[]>)) {
      for (const min of mins) {
        times.push({
          hour: parseInt(hour, 10),
          minute: parseInt(min, 10),
          totalMin: parseInt(hour, 10) * 60 + parseInt(min, 10),
          label: `${pad2(parseInt(hour, 10))}:${min}`,
          dest: key === 'arrival_times' ? '' : key.replace(/_\d+$/, ''),
        });
      }
    }
  }

  times.sort((a, b) => a.totalMin - b.totalMin);
  const seen = new Set<number>();
  return times.filter((t) => {
    if (seen.has(t.totalMin)) return false;
    seen.add(t.totalMin);
    return true;
  });
}

// ── Derived data ─────────────────────────────────────────────────────────────
const clock = computed(() => `${pad2(now.value.getHours())}:${pad2(now.value.getMinutes())}`);

const activeRoute = computed<TransportRoute | undefined>(() => routes.value[activeRouteIdx.value]);

const stations = computed<string[]>(() => activeRoute.value?.stations_order || []);

function stationHasData(name: string): boolean {
  return !!activeRoute.value && name in (activeRoute.value.departures || {});
}

const routeTerminus = computed(() => {
  const dir = activeRoute.value?.direction || '';
  const parts = dir.split(' -> ');
  return parts[1] || '';
});

const stationTimes = computed<BusTime[]>(() => {
  const route = activeRoute.value;
  if (!route || !activeStation.value) return [];
  const entry = route.departures[activeStation.value];
  if (!entry) return [];
  return getStationTimes(entry as Record<string, unknown>, dayType.value);
});

interface NextBus {
  label: string;
  badgeClass: string;
  badgeText: string;
}
const nextBuses = computed<NextBus[]>(() => {
  const n = nowMinutes();
  return stationTimes.value
    .filter((t) => t.totalMin >= n)
    .slice(0, 6)
    .map((t) => {
      const diff = t.totalMin - n;
      let badgeClass: string;
      let badgeText: string;
      if (diff <= 2) {
        badgeClass = 'tp-badge-now';
        badgeText = 'acum';
      } else if (diff <= 15) {
        badgeClass = 'tp-badge-soon';
        badgeText = formatCountdown(diff);
      } else {
        badgeClass = 'tp-badge-later';
        badgeText = formatCountdown(diff);
      }
      return { label: t.label, badgeClass, badgeText };
    });
});

interface HourRow {
  hour: number;
  isCurrent: boolean;
  chips: { label: string; cls: string }[];
}
const scheduleRows = computed<HourRow[]>(() => {
  const times = stationTimes.value;
  if (!times.length) return [];
  const n = nowMinutes();
  const currentHour = now.value.getHours();
  const nextBus = times.find((t) => t.totalMin >= n);

  const byHour = new Map<number, BusTime[]>();
  for (const t of times) {
    if (!byHour.has(t.hour)) byHour.set(t.hour, []);
    byHour.get(t.hour)!.push(t);
  }

  const rows: HourRow[] = [];
  for (const [hour, hTimes] of byHour) {
    rows.push({
      hour,
      isCurrent: hour === currentHour,
      chips: hTimes.map((t) => {
        const isPast = t.totalMin < n;
        const isNext = !!nextBus && t.totalMin === nextBus.totalMin;
        const isSoon = !isPast && !isNext && t.totalMin - n <= 15;
        let cls = '';
        if (isPast) cls = 'tp-chip-past';
        else if (isNext) cls = 'tp-chip-next';
        else if (isSoon) cls = 'tp-chip-soon';
        return { label: pad2(t.minute), cls };
      }),
    });
  }
  return rows;
});

const currentDateStr = computed(() => formatCurrentDate());

// ── Route / station selection ────────────────────────────────────────────────
function selectFirstStation(): void {
  const first = stations.value.find((name) => stationHasData(name));
  activeStation.value = first ?? null;
}

function selectRoute(idx: number): void {
  activeRouteIdx.value = idx;
  routePickerOpen.value = false;
  selectFirstStation();
}
function toggleRoutePicker(): void {
  routePickerOpen.value = !routePickerOpen.value;
}
function closeRoutePicker(): void {
  routePickerOpen.value = false;
}
function selectStation(name: string): void {
  if (!stationHasData(name)) return;
  activeStation.value = name;
}

function scrollToCurrentHour(): void {
  const scrollEl = scheduleScrollEl.value;
  if (!scrollEl) return;
  const currentRow = scrollEl.querySelector<HTMLElement>('tr.tp-current-hour');
  if (!currentRow) return;
  requestAnimationFrame(() => {
    const target =
      currentRow.offsetTop - scrollEl.clientHeight / 2 + currentRow.offsetHeight / 2;
    scrollEl.scrollTop = Math.max(0, target);
  });
}

watch([activeStation, dayType], async () => {
  await nextTick();
  scrollToCurrentHour();
});

// ── AI panel ─────────────────────────────────────────────────────────────────
interface AiMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  thinking?: boolean;
}
let aiMsgId = 0;
const aiMessages = ref<AiMessage[]>([
  {
    id: ++aiMsgId,
    role: 'assistant',
    text: 'Bună! Pot răspunde la întrebări despre programul autobuzelor. '
      + 'Selectați o stație și întrebați-mă orice.',
  },
]);
const aiInput = ref('');
const aiSending = ref(false);
const aiMessagesEl = ref<HTMLElement | null>(null);

function openAiPanel(): void {
  aiOpen.value = true;
  nextTick(() => aiInputEl.value?.focus());
}
function closeAiPanel(): void {
  aiOpen.value = false;
}
function toggleAiPanel(): void {
  if (aiOpen.value) closeAiPanel();
  else openAiPanel();
}
function scrollAiToBottom(): void {
  nextTick(() => {
    if (aiMessagesEl.value) aiMessagesEl.value.scrollTop = aiMessagesEl.value.scrollHeight;
  });
}

// Returns the assistant's reply text (empty on error/no-op) so voice-triggered
// sends can read it back aloud.
async function sendMessage(): Promise<string> {
  const message = aiInput.value.trim();
  if (!message || aiSending.value) return '';

  aiInput.value = '';
  aiSending.value = true;
  // Last 5 real turns (excluding the transient "thinking" placeholder) give the
  // backend conversational context — providers are stateless.
  const history = aiMessages.value
    .filter((m) => !m.thinking)
    .slice(-5)
    .map((m) => ({ role: m.role, content: m.text }));
  aiMessages.value.push({ id: ++aiMsgId, role: 'user', text: message });
  const thinkingId = ++aiMsgId;
  aiMessages.value.push({ id: thinkingId, role: 'assistant', text: 'Se gândește…', thinking: true });
  scrollAiToBottom();

  const route = activeRoute.value;
  const currentTime = `${pad2(now.value.getHours())}:${pad2(now.value.getMinutes())}`;

  let reply = '';
  try {
    const data = await transportApi.chat({
      message,
      route: route ? route.direction : '',
      station: activeStation.value || '',
      dayType: dayType.value,
      currentTime,
      history,
    });
    aiMessages.value = aiMessages.value.filter((m) => m.id !== thinkingId);
    if (data.error) {
      aiMessages.value.push({ id: ++aiMsgId, role: 'assistant', text: `Eroare: ${data.error}` });
    } else {
      reply = data.response || '';
      aiMessages.value.push({
        id: ++aiMsgId,
        role: 'assistant',
        text: reply || '(fără răspuns)',
      });
    }
  } catch (e) {
    aiMessages.value = aiMessages.value.filter((m) => m.id !== thinkingId);
    const msg = e instanceof Error ? e.message : String(e);
    aiMessages.value.push({ id: ++aiMsgId, role: 'assistant', text: `Eroare de conexiune: ${msg}` });
  } finally {
    aiSending.value = false;
    scrollAiToBottom();
    nextTick(() => aiInputEl.value?.focus());
  }
  return reply;
}

// ── Voice ────────────────────────────────────────────────────────────────────
// Speech recognition lives in the single global VoiceController (footer mic);
// this view only registers a handler so spoken commands reach the transport
// assistant, plus TTS for reading replies aloud.
const HEARD_PREFIX = 'Am auzit: ';

const voiceFeedback = ref<{ message: string; error: boolean } | null>(null);

let voiceLanguage = 'ro-RO';
let serverTtsAvailable = false;
let currentServerTtsAudio: HTMLAudioElement | null = null;
let feedbackTimer: number | null = null;

function showVoiceFeedback(message: string, error: boolean): void {
  voiceFeedback.value = { message, error };
  if (feedbackTimer !== null) clearTimeout(feedbackTimer);
  feedbackTimer = window.setTimeout(() => {
    voiceFeedback.value = null;
  }, 3500);
}

function speakTransportText(text: string): void {
  const clean = (text || '').trim();
  if (!clean) return;

  if (serverTtsAvailable) {
    if (currentServerTtsAudio) {
      try {
        currentServerTtsAudio.pause();
      } catch {
        /* ignore */
      }
      currentServerTtsAudio = null;
    }
    fetch(voiceApi.speakUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, lang: voiceLanguage }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('TTS failed');
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentServerTtsAudio = audio;
        const cleanup = () => {
          currentServerTtsAudio = null;
          URL.revokeObjectURL(url);
        };
        audio.addEventListener('ended', cleanup);
        audio.addEventListener('error', cleanup);
        audio.play().catch(() => undefined);
      })
      .catch(() => undefined);
    return;
  }

  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = voiceLanguage;
  window.speechSynthesis.speak(utter);
}

// Handler the global mic dispatches to while this view is mounted: drop the
// spoken text into the transport chat, send it, and read the reply back aloud
// (parity with the general AI voice flow).
async function processVoiceCommand(text: string): Promise<void> {
  const clean = (text || '').trim();
  if (!clean) return;
  openAiPanel();
  aiInput.value = clean;
  showVoiceFeedback(HEARD_PREFIX + clean, false);
  const reply = await sendMessage();
  if (reply) speakTransportText(reply);
}

async function initVoice(): Promise<void> {
  try {
    if (!prefs.data) await prefs.fetch();
    voiceLanguage = (prefs.data?.voice_language || 'ro-RO').trim() || 'ro-RO';
  } catch {
    voiceLanguage = 'ro-RO';
  }
  try {
    const serverData = await voiceApi.serverAvailable();
    serverTtsAvailable = serverData.tts_available === true;
  } catch {
    serverTtsAvailable = false;
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
async function loadRoutes(): Promise<void> {
  try {
    routes.value = await transportApi.routes();
    loadError.value = '';
    selectRoute(0);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  if (routePickerOpen.value) closeRoutePicker();
  else if (aiOpen.value) closeAiPanel();
}

onMounted(() => {
  loadRoutes();
  initVoice();
  // Claim the global mic so spoken commands reach the transport assistant.
  voiceTarget.setHandler(processVoiceCommand);
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  voiceTarget.clearHandler(processVoiceCommand);
  window.removeEventListener('keydown', onKeydown);
  if (feedbackTimer !== null) clearTimeout(feedbackTimer);
  if (currentServerTtsAudio) {
    try {
      currentServerTtsAudio.pause();
    } catch {
      /* ignore */
    }
  }
});
</script>

<template>
  <div class="transport-view">
    <!-- Sub-bar -->
    <div class="tp-subbar">
      <div class="tp-subbar-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
        <span>Transport Public</span>
      </div>
      <div class="tp-day-badge">{{ DAY_BADGE_LABELS[dayType] }}</div>
      <div class="tp-clock">{{ clock }}</div>
      <button
        type="button"
        class="tp-ai-toggle"
        :class="{ active: aiOpen }"
        title="Asistent AI"
        @click="toggleAiPanel"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        AI
      </button>
    </div>

    <div class="tp-body">
      <!-- Sidebar -->
      <aside class="tp-sidebar">
        <div class="tp-route-picker">
          <p v-if="loadError" class="tp-error">Eroare la încărcarea datelor: {{ loadError }}</p>
          <button
            v-else-if="activeRoute"
            type="button"
            class="tp-route-tab tp-route-current"
            :class="{ open: routePickerOpen }"
            :aria-expanded="routePickerOpen"
            title="Schimbă linia"
            @click="toggleRoutePicker"
          >
            <span class="tp-route-num">{{ activeRoute.route }}</span>
            <span class="tp-route-dir">
              <strong>{{ activeRoute.direction.split(' -> ')[0] }}</strong><br>
              → {{ activeRoute.direction.split(' -> ')[1] }}
            </span>
            <svg class="tp-route-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <div class="tp-day-selector">
          <button
            type="button"
            class="tp-day-btn"
            :class="{ active: dayType === 'Lucru' }"
            @click="dayType = 'Lucru'"
          >L–V</button>
          <button
            type="button"
            class="tp-day-btn"
            :class="{ active: dayType === 'Sambata' }"
            @click="dayType = 'Sambata'"
          >Sâm</button>
          <button
            type="button"
            class="tp-day-btn"
            :class="{ active: dayType === 'Duminica' }"
            @click="dayType = 'Duminica'"
          >Dum</button>
        </div>

        <div class="tp-station-list">
          <p v-if="!activeRoute" class="tp-empty">Selectați o rută.</p>
          <div
            v-for="name in stations"
            v-else
            :key="name"
            class="tp-station-item"
            :class="{
              active: name === activeStation,
              'no-data': !stationHasData(name),
            }"
            @click="selectStation(name)"
          >
            <div class="tp-station-line">
              <div v-if="stations.indexOf(name) !== 0" class="tp-station-connector"></div>
              <div class="tp-station-dot"></div>
              <div v-if="stations.indexOf(name) !== stations.length - 1" class="tp-station-connector"></div>
            </div>
            <div class="tp-station-name">{{ name }}</div>
          </div>
        </div>
      </aside>

      <!-- Content -->
      <main class="tp-content">
        <div v-if="!activeRoute || !activeStation" class="tp-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          <p>Selectați o rută și o stație<br>pentru a vedea programul.</p>
        </div>

        <template v-else>
          <!-- Station header -->
          <div class="tp-station-header">
            <div class="tp-station-header-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
            </div>
            <div class="tp-station-header-info">
              <div class="tp-station-header-name">{{ activeStation }}</div>
              <div class="tp-station-header-route">
                Linia {{ activeRoute.route }} → {{ routeTerminus }} · {{ dayType }}
              </div>
            </div>
          </div>

          <!-- Next buses -->
          <div class="tp-next-card">
            <div class="tp-next-card-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Următoarele curse
            </div>
            <div class="tp-next-buses">
              <div v-if="!nextBuses.length" class="tp-no-buses">
                Nu mai sunt curse astăzi din această stație.
              </div>
              <div v-for="(bus, bi) in nextBuses" v-else :key="bi" class="tp-next-bus-row">
                <div class="tp-next-bus-time">{{ bus.label }}</div>
                <div class="tp-next-bus-badge" :class="bus.badgeClass">{{ bus.badgeText }}</div>
                <div v-if="routeTerminus" class="tp-next-bus-dest">→ {{ routeTerminus }}</div>
              </div>
            </div>
          </div>

          <!-- Full schedule -->
          <div class="tp-schedule-card">
            <div class="tp-schedule-header">
              <span>Program complet</span>
              <span>{{ stationTimes.length }} curse</span>
            </div>
            <div ref="scheduleScrollEl" class="tp-schedule-scroll">
              <div v-if="!scheduleRows.length" class="tp-no-buses">
                Program indisponibil pentru această zi.
              </div>
              <table v-else class="tp-schedule-table">
                <thead>
                  <tr>
                    <th>Ora</th>
                    <th>Minute</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in scheduleRows"
                    :key="row.hour"
                    :class="{ 'tp-current-hour': row.isCurrent }"
                  >
                    <td class="tp-hour-cell">
                      <template v-if="row.isCurrent">
                        <div class="tp-hour-main">{{ pad2(row.hour) }}</div>
                        <div class="tp-hour-date">{{ currentDateStr }}</div>
                      </template>
                      <template v-else>{{ pad2(row.hour) }}</template>
                    </td>
                    <td>
                      <div class="tp-mins-cell">
                        <span
                          v-for="(chip, ci) in row.chips"
                          :key="ci"
                          class="tp-min-chip"
                          :class="chip.cls"
                        >{{ chip.label }}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </main>

      <!-- AI panel -->
      <aside class="tp-ai-panel" :class="{ open: aiOpen }">
        <div class="tp-ai-header">
          <span>Asistent Transport</span>
          <button type="button" class="tp-ai-close" title="Închide" @click="closeAiPanel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div ref="aiMessagesEl" class="tp-ai-messages">
          <div
            v-for="msg in aiMessages"
            :key="msg.id"
            class="tp-ai-msg"
            :class="[
              msg.role === 'user' ? 'tp-ai-user' : 'tp-ai-assistant',
              msg.thinking ? 'tp-ai-thinking' : '',
            ]"
          >
            <div
              class="tp-ai-bubble"
              :title="msg.role === 'assistant' && !msg.thinking ? 'Click pentru a asculta mesajul' : ''"
              @click="msg.role === 'assistant' && !msg.thinking && speakTransportText(msg.text)"
            >{{ msg.text }}<span
                v-if="msg.role === 'assistant' && !msg.thinking"
                class="tp-ai-tts-icon"
              >🔊</span></div>
          </div>
        </div>
        <div class="tp-ai-input-row">
          <input
            ref="aiInputEl"
            v-model="aiInput"
            type="text"
            class="tp-ai-input"
            placeholder="Ex: Când pleacă următorul autobuz?"
            autocomplete="off"
            @keydown.enter.prevent="sendMessage"
            @keydown.esc="closeAiPanel"
          >
          <button
            type="button"
            class="tp-ai-send"
            title="Trimite"
            :disabled="aiSending"
            @click="sendMessage"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
        <div class="tp-ai-note">Datele au caracter orientativ.</div>
      </aside>
    </div>

    <!-- Route picker popup -->
    <div v-if="routePickerOpen" class="tp-route-modal-overlay" @click="closeRoutePicker">
      <div class="tp-route-modal" role="dialog" aria-label="Selectează linia" @click.stop>
        <div class="tp-route-modal-header">
          <span>Selectează linia</span>
          <button type="button" class="tp-route-modal-close" title="Închide" @click="closeRoutePicker">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tp-route-modal-list">
          <button
            v-for="(route, idx) in routes"
            :key="route.route + idx"
            type="button"
            class="tp-route-tab"
            :class="{ active: idx === activeRouteIdx }"
            @click="selectRoute(idx)"
          >
            <span class="tp-route-num">{{ route.route }}</span>
            <span class="tp-route-dir">
              <strong>{{ route.direction.split(' -> ')[0] }}</strong><br>
              → {{ route.direction.split(' -> ')[1] }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="voiceFeedback"
      class="tp-voice-feedback"
      :data-error="voiceFeedback.error ? 'true' : undefined"
      role="status"
    >{{ voiceFeedback.message }}</div>
  </div>
</template>
