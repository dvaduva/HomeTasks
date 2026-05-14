<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { calendarApi } from '@/api/calendar';
import type { CalendarMonth, CalendarTask, CalendarYear } from '@/api/calendar';
import { useUsersStore } from '@/stores/users';
import { useNotification } from '@/composables/useNotification';
import '@/assets/css/calendar.css';

const ROMANIAN_MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const WEEKDAYS_SHORT = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
const MAX_TASKS_IN_DAY_CELL = 3;
const MAX_DOTS_IN_MINI_DAY = 4;

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Zilnic',
  weekly: 'Săptămânal',
  monthly: 'Lunar',
  yearly: 'Anual',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'În așteptare',
  completed: 'Finalizat',
  refused: 'Refuzat',
};

const users = useUsersStore();
const { error: errorToast } = useNotification();

type ViewMode = 'month' | 'year';
const view = ref<ViewMode>('month');
const cursor = ref<Date>(new Date());
const selectedUserIds = ref<Set<number>>(new Set());
const loading = ref(false);
const loadError = ref(false);
const monthData = ref<CalendarMonth | null>(null);
const yearData = ref<CalendarYear | null>(null);

const monthCache = new Map<string, CalendarMonth>();
const yearCache = new Map<string, CalendarYear>();

const dayModalOpen = ref(false);
const dayModalKey = ref<string>('');

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

const userIdsParam = computed<number[] | undefined>(() =>
  selectedUserIds.value.size ? [...selectedUserIds.value] : undefined,
);
function cacheSuffix(): string {
  return userIdsParam.value ? userIdsParam.value.join(',') : 'all';
}

const periodLabel = computed(() =>
  view.value === 'month'
    ? `${ROMANIAN_MONTHS[cursor.value.getMonth()]} ${cursor.value.getFullYear()}`
    : `${cursor.value.getFullYear()}`,
);

async function loadData(): Promise<void> {
  loading.value = true;
  loadError.value = false;
  try {
    if (view.value === 'month') {
      const year = cursor.value.getFullYear();
      const month = cursor.value.getMonth() + 1;
      const key = `${year}-${pad(month)}|${cacheSuffix()}`;
      let data = monthCache.get(key);
      if (!data) {
        data = await calendarApi.month(year, month, userIdsParam.value);
        monthCache.set(key, data);
      }
      monthData.value = data;
    } else {
      const year = cursor.value.getFullYear();
      const key = `${year}|${cacheSuffix()}`;
      let data = yearCache.get(key);
      if (!data) {
        data = await calendarApi.year(year, userIdsParam.value);
        yearCache.set(key, data);
      }
      yearData.value = data;
    }
  } catch (e) {
    loadError.value = true;
    errorToast(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}

function shiftCursor(delta: number): void {
  const d = new Date(cursor.value);
  if (view.value === 'month') {
    d.setMonth(d.getMonth() + delta, 1);
  } else {
    d.setFullYear(d.getFullYear() + delta, 0, 1);
  }
  cursor.value = d;
}

function setView(v: ViewMode): void {
  if (view.value === v) return;
  view.value = v;
}

function goToday(): void {
  cursor.value = new Date();
}

function toggleUser(id: number | '__all'): void {
  if (id === '__all') {
    selectedUserIds.value = new Set();
  } else {
    const next = new Set(selectedUserIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (next.size === users.items.length) next.clear();
    selectedUserIds.value = next;
  }
}

function isUserActive(id: number): boolean {
  return selectedUserIds.value.size === 0 || selectedUserIds.value.has(id);
}

// ── Month grid ───────────────────────────────────────────────────────────────
interface MonthCell {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  tasks: CalendarTask[];
}

const monthCells = computed<MonthCell[]>(() => {
  const data = monthData.value;
  if (view.value !== 'month' || !data) return [];
  const year = data.year;
  const month = data.month;
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const today = new Date();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const totalDays = lastOfMonth.getDate();
  const totalCells = Math.ceil((firstWeekday + totalDays) / 7) * 7;

  const cells: MonthCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayOffset = i - firstWeekday;
    const date = new Date(year, month - 1, 1 + dayOffset);
    const dateKey = isoDate(date);
    const dow = date.getDay();
    cells.push({
      date,
      dateKey,
      inMonth: date.getMonth() === month - 1,
      isToday: isSameDay(date, today),
      isWeekend: dow === 0 || dow === 6,
      tasks: data.days[dateKey] || [],
    });
  }
  return cells;
});

const monthWeekRows = computed(() => monthCells.value.length / 7);

function pillTime(t: CalendarTask): string {
  return (t.scheduled_date || '').slice(11, 16);
}
function visiblePills(tasks: CalendarTask[]): CalendarTask[] {
  return tasks.slice(0, MAX_TASKS_IN_DAY_CELL);
}
function pillOverflow(tasks: CalendarTask[]): number {
  return Math.max(0, tasks.length - MAX_TASKS_IN_DAY_CELL);
}

// ── Year grid ────────────────────────────────────────────────────────────────
interface MiniCell {
  empty: boolean;
  day?: number;
  dateKey?: string;
  heat?: number;
  isToday?: boolean;
  isWeekend?: boolean;
  total?: number;
  dots?: { color: string; title: string }[];
}
interface MiniMonth {
  monthIndex: number;
  name: string;
  cells: MiniCell[];
}

function heatBucket(count: number): number {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  if (count <= 8) return 4;
  return 5;
}

const miniMonths = computed<MiniMonth[]>(() => {
  const data = yearData.value;
  if (view.value !== 'year' || !data) return [];
  const today = new Date();
  const result: MiniMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(data.year, m, 1);
    const lastOfMonth = new Date(data.year, m + 1, 0);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const totalDays = lastOfMonth.getDate();
    const cells: MiniCell[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ empty: true });
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(data.year, m, day);
      const dateKey = isoDate(date);
      const dayInfo = data.days[dateKey];
      const total = dayInfo ? dayInfo.total : 0;
      const dow = date.getDay();
      cells.push({
        empty: false,
        day,
        dateKey,
        heat: heatBucket(total),
        isToday: isSameDay(date, today),
        isWeekend: dow === 0 || dow === 6,
        total,
        dots: dayInfo
          ? dayInfo.users.slice(0, MAX_DOTS_IN_MINI_DAY).map((u) => ({
              color: u.user_color || '#64748b',
              title: `${u.user_name || ''}: ${u.count}`,
            }))
          : [],
      });
    }
    result.push({ monthIndex: m, name: ROMANIAN_MONTHS[m], cells });
  }
  return result;
});

const yearLegend = [
  { cls: '', label: '0' },
  { cls: 'heat-1', label: '1' },
  { cls: 'heat-2', label: '2-3' },
  { cls: 'heat-3', label: '4-5' },
  { cls: 'heat-4', label: '6-8' },
  { cls: 'heat-5', label: '9+' },
];

function openMiniMonth(monthIndex: number): void {
  cursor.value = new Date(cursor.value.getFullYear(), monthIndex, 1);
  setView('month');
}
function openMiniDay(dateKey: string): void {
  const [yy, mm, dd] = dateKey.split('-').map(Number);
  cursor.value = new Date(yy, mm - 1, dd);
  setView('month');
}

// ── Day modal ────────────────────────────────────────────────────────────────
const dayModalTitle = computed(() => {
  if (!dayModalKey.value) return '';
  const [yy, mm, dd] = dayModalKey.value.split('-').map(Number);
  return new Date(yy, mm - 1, dd).toLocaleDateString('ro-RO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
});

interface DayUserGroup {
  userName: string;
  userColor: string;
  tasks: CalendarTask[];
}
const dayModalGroups = computed<DayUserGroup[]>(() => {
  const data = monthData.value;
  if (!data || !dayModalKey.value) return [];
  const tasks = (data.days[dayModalKey.value] || []).slice();
  const byUser = new Map<number, DayUserGroup>();
  for (const t of tasks) {
    const key = t.user_id ?? -1;
    if (!byUser.has(key)) {
      byUser.set(key, {
        userName: t.user_name || 'Necunoscut',
        userColor: t.user_color || '#64748b',
        tasks: [],
      });
    }
    byUser.get(key)!.tasks.push(t);
  }
  for (const group of byUser.values()) {
    group.tasks.sort((a, b) =>
      (a.scheduled_date || '').localeCompare(b.scheduled_date || ''),
    );
  }
  return [...byUser.values()];
});

function openDayModal(dateKey: string): void {
  dayModalKey.value = dateKey;
  dayModalOpen.value = true;
}
function closeDayModal(): void {
  dayModalOpen.value = false;
}
function modalTaskTime(t: CalendarTask): string {
  return (t.scheduled_date || '').slice(11, 16) || '—';
}
function modalRecurrence(t: CalendarTask): string {
  if (!t.recurrence_pattern || t.recurrence_pattern === 'none') return '';
  const label = RECURRENCE_LABELS[t.recurrence_pattern] || t.recurrence_pattern;
  return t.is_recurring_instance ? `${label} ↻` : label;
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeDayModal();
}

watch([view, cursor, selectedUserIds], loadData);

onMounted(async () => {
  await users.fetchAll().catch(() => undefined);
  await loadData();
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="cal-content calendar-view" @keydown="onKeydown">
    <div class="cal-toolbar">
      <div class="cal-nav">
        <button type="button" class="cal-nav-btn" title="Anterior" aria-label="Anterior" @click="shiftCursor(-1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="cal-period">{{ periodLabel }}</span>
        <button type="button" class="cal-nav-btn" title="Următor" aria-label="Următor" @click="shiftCursor(1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button type="button" class="cal-today-btn" @click="goToday">Astăzi</button>
      </div>

      <div class="cal-view-switch" role="tablist">
        <button
          type="button"
          class="cal-view-btn"
          :class="{ active: view === 'month' }"
          role="tab"
          :aria-selected="view === 'month'"
          @click="setView('month')"
        >Lună</button>
        <button
          type="button"
          class="cal-view-btn"
          :class="{ active: view === 'year' }"
          role="tab"
          :aria-selected="view === 'year'"
          @click="setView('year')"
        >An</button>
      </div>
    </div>

    <div class="cal-user-filter">
      <span class="cal-filter-label">Utilizatori:</span>
      <span class="cal-filter-chips">
        <span v-if="!users.items.length" class="cal-filter-empty">Niciun utilizator.</span>
        <template v-else>
          <span
            class="cal-filter-chip"
            :class="{ active: selectedUserIds.size === 0 }"
            @click="toggleUser('__all')"
          >
            <span>Toți</span>
          </span>
          <span
            v-for="u in users.items"
            :key="u.id"
            class="cal-filter-chip"
            :class="{ active: isUserActive(u.id) }"
            @click="toggleUser(u.id)"
          >
            <span class="chip-dot" :style="{ background: u.color || '#64748b' }"></span>
            <span>{{ u.name }}</span>
          </span>
        </template>
      </span>
    </div>

    <div class="cal-view">
      <p v-if="loading" class="cal-empty">Se încarcă...</p>
      <p v-else-if="loadError" class="cal-empty">Eroare la încărcare.</p>

      <!-- Month view -->
      <div v-else-if="view === 'month'" class="cal-month-grid">
        <div class="cal-weekday-row">
          <div
            v-for="(w, idx) in WEEKDAYS_SHORT"
            :key="w"
            class="cal-weekday"
            :class="{ 'is-weekend': idx >= 5 }"
          >{{ w }}</div>
        </div>
        <div
          class="cal-month-rows"
          :style="{ gridTemplateRows: `repeat(${monthWeekRows}, minmax(0, 1fr))` }"
        >
          <div
            v-for="cell in monthCells"
            :key="cell.dateKey"
            class="cal-day"
            :class="{
              'is-other-month': !cell.inMonth,
              'is-today': cell.isToday,
              'is-weekend': cell.isWeekend,
            }"
            @click="openDayModal(cell.dateKey)"
          >
            <div class="cal-day-num">
              <span class="num">{{ cell.date.getDate() }}</span>
              <span v-if="cell.tasks.length" class="cal-day-count">{{ cell.tasks.length }}</span>
            </div>
            <div class="cal-day-tasks">
              <span
                v-for="(t, ti) in visiblePills(cell.tasks)"
                :key="ti"
                class="cal-task-pill"
                :class="t.status ? `is-${t.status}` : ''"
                :style="{ background: t.user_color || '#64748b' }"
                :title="`${t.user_name || ''} — ${t.description || ''}`"
              >
                <span class="pill-time">{{ pillTime(t) }}</span>
                <span class="pill-desc">{{ t.description }}</span>
                <span v-if="t.is_recurring_instance" class="pill-recur">↻</span>
              </span>
              <span v-if="pillOverflow(cell.tasks)" class="cal-task-more">
                +{{ pillOverflow(cell.tasks) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Year view -->
      <template v-else>
        <div class="cal-year-grid">
          <div v-for="mm in miniMonths" :key="mm.monthIndex" class="cal-mini-month">
            <div class="cal-mini-title" @click="openMiniMonth(mm.monthIndex)">
              {{ mm.name }}
            </div>
            <div class="cal-mini-grid">
              <div
                v-for="(w, idx) in WEEKDAYS_SHORT"
                :key="`wd-${w}`"
                class="cal-mini-weekday"
                :class="{ 'is-weekend': idx >= 5 }"
              >{{ w }}</div>
              <div
                v-for="(cell, ci) in mm.cells"
                :key="ci"
                class="cal-mini-day"
                :class="[
                  cell.empty ? 'is-empty-cell' : '',
                  cell.heat ? `heat-${cell.heat}` : '',
                  cell.isToday ? 'is-today' : '',
                  cell.isWeekend ? 'is-weekend' : '',
                ]"
                :title="cell.total ? `${cell.total} task${cell.total > 1 ? 'uri' : ''}` : ''"
                @click="!cell.empty && cell.dateKey && openMiniDay(cell.dateKey)"
              >
                <template v-if="!cell.empty">
                  <span class="cal-mini-num">{{ cell.day }}</span>
                  <span class="cal-mini-dots">
                    <span
                      v-for="(dot, di) in cell.dots"
                      :key="di"
                      class="cal-mini-dot"
                      :style="{ background: dot.color }"
                      :title="dot.title"
                    ></span>
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div class="cal-year-legend">
          <span>Densitate taskuri:</span>
          <span class="cal-year-legend-scale">
            <template v-for="b in yearLegend" :key="b.label">
              <span class="swatch cal-mini-day" :class="b.cls" style="cursor:default"></span>{{ b.label }}
            </template>
          </span>
        </div>
      </template>
    </div>
  </div>

  <!-- Day modal -->
  <div v-if="dayModalOpen" class="cal-modal-overlay" @click.self="closeDayModal">
    <div class="cal-modal" role="dialog" aria-modal="true">
      <div class="cal-modal-head">
        <h2>{{ dayModalTitle }}</h2>
        <button type="button" class="cal-modal-close" aria-label="Închide" @click="closeDayModal">✕</button>
      </div>
      <div class="cal-modal-body">
        <p v-if="!dayModalGroups.length" class="cal-modal-empty">
          Nicio activitate în această zi.
        </p>
        <div v-for="(group, gi) in dayModalGroups" :key="gi" class="cal-modal-user-group">
          <div class="cal-modal-user-head">
            <span class="cal-modal-user-dot" :style="{ background: group.userColor }"></span>
            {{ group.userName }}
            <span style="opacity:.6;font-weight:400">({{ group.tasks.length }})</span>
          </div>
          <div
            v-for="(t, ti) in group.tasks"
            :key="ti"
            class="cal-modal-task"
            :class="{ 'is-completed': t.status === 'completed' }"
          >
            <div class="cal-modal-task-time">{{ modalTaskTime(t) }}</div>
            <div class="cal-modal-task-body">
              <div class="cal-modal-task-desc">{{ t.description }}</div>
              <div class="cal-modal-task-meta">
                <span class="cal-modal-status" :class="t.status || 'pending'">
                  {{ STATUS_LABELS[t.status || 'pending'] || t.status }}
                </span>
                <span v-if="modalRecurrence(t)">{{ modalRecurrence(t) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
