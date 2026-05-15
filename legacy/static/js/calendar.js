const ROMANIAN_MONTHS = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const ROMANIAN_MONTHS_SHORT = [
    'ian', 'feb', 'mar', 'apr', 'mai', 'iun',
    'iul', 'aug', 'sep', 'oct', 'noi', 'dec',
];
const WEEKDAYS_SHORT = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];
const MAX_TASKS_IN_DAY_CELL = 3;
const MAX_DOTS_IN_MINI_DAY = 4;

const RECURRENCE_LABELS = {
    daily: 'Zilnic',
    weekly: 'Săptămânal',
    monthly: 'Lunar',
    yearly: 'Anual',
};

const STATUS_LABELS = {
    pending: 'În așteptare',
    completed: 'Finalizat',
    refused: 'Refuzat',
};

const state = {
    view: 'month', // 'month' | 'year'
    cursor: new Date(), // any date inside displayed period
    users: [],
    selectedUserIds: new Set(), // empty == all
    monthCache: {}, // 'YYYY-MM' -> response
    yearCache: {}, // 'YYYY' -> response
};

function pad(n) { return String(n).padStart(2, '0'); }

function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function clockTick() {
    const el = document.getElementById('cal-clock');
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString('ro-RO', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

// ── Data fetching ────────────────────────────────────────────────────────────

function buildUserIdsParam() {
    if (!state.selectedUserIds.size) return '';
    return Array.from(state.selectedUserIds).join(',');
}

function cacheKey(extra) {
    return `${extra}|${buildUserIdsParam()}`;
}

async function fetchMonth(year, month) {
    const key = cacheKey(`${year}-${pad(month)}`);
    if (state.monthCache[key]) return state.monthCache[key];

    const params = new URLSearchParams({ year: String(year), month: String(month) });
    const userIds = buildUserIdsParam();
    if (userIds) params.set('user_ids', userIds);

    const r = await fetch(`/api/calendar/month?${params.toString()}`);
    const data = await r.json();
    state.monthCache[key] = data;
    return data;
}

async function fetchYear(year) {
    const key = cacheKey(`${year}`);
    if (state.yearCache[key]) return state.yearCache[key];

    const params = new URLSearchParams({ year: String(year) });
    const userIds = buildUserIdsParam();
    if (userIds) params.set('user_ids', userIds);

    const r = await fetch(`/api/calendar/year?${params.toString()}`);
    const data = await r.json();
    state.yearCache[key] = data;
    return data;
}

function invalidateCaches() {
    state.monthCache = {};
    state.yearCache = {};
}

// ── User filter chips ────────────────────────────────────────────────────────

async function loadUsers() {
    try {
        const r = await fetch('/api/users');
        state.users = await r.json();
    } catch {
        state.users = [];
    }
    renderUserChips();
}

function renderUserChips() {
    const container = document.getElementById('cal-filter-chips');
    if (!container) return;
    if (!state.users.length) {
        container.innerHTML = '<span class="cal-filter-empty">Niciun utilizator.</span>';
        return;
    }

    const chips = state.users.map(u => {
        const isActive = !state.selectedUserIds.size || state.selectedUserIds.has(u.id);
        return `
            <span class="cal-filter-chip${isActive ? ' active' : ''}" data-user-id="${u.id}">
                <span class="chip-dot" style="background:${escapeHtml(u.color || '#64748b')}"></span>
                <span>${escapeHtml(u.name)}</span>
            </span>
        `;
    }).join('');

    const allActive = !state.selectedUserIds.size;
    container.innerHTML = `
        <span class="cal-filter-chip${allActive ? ' active' : ''}" data-user-id="__all">
            <span>Toți</span>
        </span>
        ${chips}
    `;

    container.querySelectorAll('.cal-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const id = chip.dataset.userId;
            if (id === '__all') {
                state.selectedUserIds.clear();
            } else {
                const numericId = Number(id);
                if (state.selectedUserIds.has(numericId)) {
                    state.selectedUserIds.delete(numericId);
                } else {
                    state.selectedUserIds.add(numericId);
                }
                if (state.selectedUserIds.size === state.users.length) {
                    state.selectedUserIds.clear(); // all selected == none stored
                }
            }
            invalidateCaches();
            renderUserChips();
            render();
        });
    });
}

// ── Period header / navigation ───────────────────────────────────────────────

function setPeriodLabel() {
    const el = document.getElementById('cal-period');
    if (!el) return;
    if (state.view === 'month') {
        el.textContent = `${ROMANIAN_MONTHS[state.cursor.getMonth()]} ${state.cursor.getFullYear()}`;
    } else {
        el.textContent = `${state.cursor.getFullYear()}`;
    }
}

function shiftCursor(delta) {
    const d = new Date(state.cursor);
    if (state.view === 'month') {
        d.setMonth(d.getMonth() + delta, 1);
    } else {
        d.setFullYear(d.getFullYear() + delta, 0, 1);
    }
    state.cursor = d;
}

function setView(view) {
    if (state.view === view) return;
    state.view = view;
    document.querySelectorAll('.cal-view-btn').forEach(b => {
        const isActive = b.dataset.view === view;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    render();
}

// ── Month view rendering ─────────────────────────────────────────────────────

async function renderMonth() {
    const container = document.getElementById('cal-view');
    container.innerHTML = '<p class="cal-empty">Se încarcă...</p>';

    let data;
    try {
        data = await fetchMonth(state.cursor.getFullYear(), state.cursor.getMonth() + 1);
    } catch {
        container.innerHTML = '<p class="cal-empty">Eroare la încărcare.</p>';
        return;
    }

    const year = data.year;
    const month = data.month;
    const firstOfMonth = new Date(year, month - 1, 1);
    const lastOfMonth = new Date(year, month, 0);
    const today = new Date();

    // ISO weeks: Monday = 0
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const totalDays = lastOfMonth.getDate();
    const cells = firstWeekday + totalDays;
    const totalCells = Math.ceil(cells / 7) * 7;

    let weekdayRow = '<div class="cal-weekday-row">';
    WEEKDAYS_SHORT.forEach((w, idx) => {
        const isWeekend = idx >= 5; // Saturday=5, Sunday=6 in our L M M J V S D order
        weekdayRow += `<div class="cal-weekday${isWeekend ? ' is-weekend' : ''}">${w}</div>`;
    });
    weekdayRow += '</div>';

    const weekRows = totalCells / 7;
    let dayCells = `<div class="cal-month-rows" style="grid-template-rows: repeat(${weekRows}, minmax(0, 1fr))">`;

    for (let i = 0; i < totalCells; i++) {
        const dayOffset = i - firstWeekday;
        const cellDate = new Date(year, month - 1, 1 + dayOffset);
        const inMonth = cellDate.getMonth() === month - 1;
        const dateKey = isoDate(cellDate);
        const tasks = data.days[dateKey] || [];
        const isToday = isSameDay(cellDate, today);
        const dayOfWeek = cellDate.getDay(); // 0 = Sunday, 6 = Saturday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const classes = ['cal-day'];
        if (!inMonth) classes.push('is-other-month');
        if (isToday) classes.push('is-today');
        if (isWeekend) classes.push('is-weekend');

        dayCells += `
            <div class="${classes.join(' ')}" data-date="${dateKey}">
                <div class="cal-day-num">
                    <span class="num">${cellDate.getDate()}</span>
                    ${tasks.length ? `<span class="cal-day-count">${tasks.length}</span>` : ''}
                </div>
                <div class="cal-day-tasks">
                    ${renderTaskPills(tasks)}
                </div>
            </div>
        `;
    }
    dayCells += '</div>';

    container.innerHTML = `<div class="cal-month-grid">${weekdayRow}${dayCells}</div>`;

    container.querySelectorAll('.cal-day').forEach(cell => {
        cell.addEventListener('click', () => openDayModal(cell.dataset.date, data));
    });
}

function renderTaskPills(tasks) {
    if (!tasks.length) return '';
    const visible = tasks.slice(0, MAX_TASKS_IN_DAY_CELL);
    const overflow = tasks.length - visible.length;

    const pills = visible.map(t => {
        const time = (t.scheduled_date || '').slice(11, 16);
        const color = t.user_color || '#64748b';
        const statusClass = t.status ? `is-${t.status}` : '';
        const recurMark = t.is_recurring_instance ? '↻' : '';
        return `
            <span class="cal-task-pill ${statusClass}" style="background:${escapeHtml(color)}"
                  title="${escapeHtml(t.user_name || '')} — ${escapeHtml(t.description || '')}">
                <span class="pill-time">${escapeHtml(time)}</span>
                <span class="pill-desc">${escapeHtml(t.description || '')}</span>
                ${recurMark ? `<span class="pill-recur">${recurMark}</span>` : ''}
            </span>
        `;
    }).join('');

    return pills + (overflow > 0 ? `<span class="cal-task-more">+${overflow}</span>` : '');
}

// ── Year view rendering ──────────────────────────────────────────────────────

function heatBucket(count) {
    if (count <= 0) return 0;
    if (count <= 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    if (count <= 8) return 4;
    return 5;
}

async function renderYear() {
    const container = document.getElementById('cal-view');
    container.innerHTML = '<p class="cal-empty">Se încarcă...</p>';

    let data;
    try {
        data = await fetchYear(state.cursor.getFullYear());
    } catch {
        container.innerHTML = '<p class="cal-empty">Eroare la încărcare.</p>';
        return;
    }

    const today = new Date();
    let html = '<div class="cal-year-grid">';

    for (let m = 0; m < 12; m++) {
        html += renderMiniMonth(data.year, m, data.days, today);
    }

    html += '</div>';
    html += renderYearLegend();

    container.innerHTML = html;

    container.querySelectorAll('.cal-mini-title').forEach(el => {
        el.addEventListener('click', () => {
            const month = Number(el.dataset.month);
            state.cursor = new Date(data.year, month, 1);
            setView('month');
        });
    });

    container.querySelectorAll('.cal-mini-day:not(.is-empty-cell)').forEach(cell => {
        cell.addEventListener('click', () => {
            const dateKey = cell.dataset.date;
            if (!dateKey) return;
            const [yy, mm] = dateKey.split('-').map(Number);
            state.cursor = new Date(yy, mm - 1, Number(dateKey.split('-')[2]));
            setView('month');
        });
    });
}

function renderMiniMonth(year, monthIndex, daysData, today) {
    const firstOfMonth = new Date(year, monthIndex, 1);
    const lastOfMonth = new Date(year, monthIndex + 1, 0);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
    const totalDays = lastOfMonth.getDate();

    let cells = '';
    WEEKDAYS_SHORT.forEach((w, idx) => {
        const isWeekend = idx >= 5;
        cells += `<div class="cal-mini-weekday${isWeekend ? ' is-weekend' : ''}">${w}</div>`;
    });

    for (let i = 0; i < firstWeekday; i++) {
        cells += '<div class="cal-mini-day is-empty-cell"></div>';
    }

    for (let day = 1; day <= totalDays; day++) {
        const cellDate = new Date(year, monthIndex, day);
        const dateKey = isoDate(cellDate);
        const dayInfo = daysData[dateKey];
        const total = dayInfo ? dayInfo.total : 0;
        const heat = heatBucket(total);
        const isToday = isSameDay(cellDate, today);
        const dayOfWeek = cellDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const dots = dayInfo ? renderMiniDots(dayInfo.users) : '';

        const classes = ['cal-mini-day'];
        if (heat) classes.push(`heat-${heat}`);
        if (isToday) classes.push('is-today');
        if (isWeekend) classes.push('is-weekend');

        cells += `
            <div class="${classes.join(' ')}"
                 data-date="${dateKey}"
                 title="${total ? `${total} task${total > 1 ? 'uri' : ''}` : ''}">
                <span class="cal-mini-num">${day}</span>
                <span class="cal-mini-dots">${dots}</span>
            </div>
        `;
    }

    return `
        <div class="cal-mini-month">
            <div class="cal-mini-title" data-month="${monthIndex}">
                ${ROMANIAN_MONTHS[monthIndex]}
            </div>
            <div class="cal-mini-grid">${cells}</div>
        </div>
    `;
}

function renderMiniDots(users) {
    const visible = users.slice(0, MAX_DOTS_IN_MINI_DAY);
    return visible.map(u =>
        `<span class="cal-mini-dot" style="background:${escapeHtml(u.user_color || '#64748b')}"
               title="${escapeHtml(u.user_name || '')}: ${u.count}"></span>`
    ).join('');
}

function renderYearLegend() {
    const buckets = [
        { cls: '', label: '0' },
        { cls: 'heat-1', label: '1' },
        { cls: 'heat-2', label: '2-3' },
        { cls: 'heat-3', label: '4-5' },
        { cls: 'heat-4', label: '6-8' },
        { cls: 'heat-5', label: '9+' },
    ];
    const swatches = buckets.map(b =>
        `<span class="swatch cal-mini-day ${b.cls}" style="cursor:default"></span>${b.label}`
    ).join(' ');
    return `
        <div class="cal-year-legend">
            <span>Densitate taskuri:</span>
            <span class="cal-year-legend-scale">${swatches}</span>
        </div>
    `;
}

// ── Day modal ────────────────────────────────────────────────────────────────

function openDayModal(dateKey, monthData) {
    const overlay = document.getElementById('cal-day-modal');
    const titleEl = document.getElementById('cal-day-modal-title');
    const bodyEl = document.getElementById('cal-day-modal-body');
    if (!overlay || !titleEl || !bodyEl) return;

    const [yy, mm, dd] = dateKey.split('-').map(Number);
    const date = new Date(yy, mm - 1, dd);
    titleEl.textContent = date.toLocaleDateString('ro-RO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    const tasks = (monthData.days[dateKey] || []).slice();

    if (!tasks.length) {
        bodyEl.innerHTML = '<p class="cal-modal-empty">Nicio activitate în această zi.</p>';
        overlay.hidden = false;
        return;
    }

    // Group by user
    const byUser = new Map();
    tasks.forEach(t => {
        const key = t.user_id ?? -1;
        if (!byUser.has(key)) {
            byUser.set(key, {
                userName: t.user_name || 'Necunoscut',
                userColor: t.user_color || '#64748b',
                tasks: [],
            });
        }
        byUser.get(key).tasks.push(t);
    });

    let html = '';
    for (const group of byUser.values()) {
        group.tasks.sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || ''));
        html += `
            <div class="cal-modal-user-group">
                <div class="cal-modal-user-head">
                    <span class="cal-modal-user-dot" style="background:${escapeHtml(group.userColor)}"></span>
                    ${escapeHtml(group.userName)}
                    <span style="opacity:.6;font-weight:400">(${group.tasks.length})</span>
                </div>
                ${group.tasks.map(t => renderModalTask(t)).join('')}
            </div>
        `;
    }
    bodyEl.innerHTML = html;
    overlay.hidden = false;
}

function renderModalTask(t) {
    const time = (t.scheduled_date || '').slice(11, 16) || '—';
    const status = t.status || 'pending';
    const statusLabel = STATUS_LABELS[status] || status;
    const isCompletedClass = status === 'completed' ? ' is-completed' : '';
    const recurrenceHtml = t.recurrence_pattern && t.recurrence_pattern !== 'none'
        ? `<span>${escapeHtml(RECURRENCE_LABELS[t.recurrence_pattern] || t.recurrence_pattern)}${t.is_recurring_instance ? ' ↻' : ''}</span>`
        : '';

    return `
        <div class="cal-modal-task${isCompletedClass}">
            <div class="cal-modal-task-time">${escapeHtml(time)}</div>
            <div class="cal-modal-task-body">
                <div class="cal-modal-task-desc">${escapeHtml(t.description || '')}</div>
                <div class="cal-modal-task-meta">
                    <span class="cal-modal-status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                    ${recurrenceHtml}
                </div>
            </div>
        </div>
    `;
}

function closeDayModal() {
    const overlay = document.getElementById('cal-day-modal');
    if (overlay) overlay.hidden = true;
}

// ── Render dispatcher ────────────────────────────────────────────────────────

function render() {
    setPeriodLabel();
    if (state.view === 'month') {
        renderMonth();
    } else {
        renderYear();
    }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    clockTick();
    setInterval(clockTick, 1000);

    document.getElementById('cal-prev').addEventListener('click', () => {
        shiftCursor(-1);
        render();
    });
    document.getElementById('cal-next').addEventListener('click', () => {
        shiftCursor(1);
        render();
    });
    document.getElementById('cal-today').addEventListener('click', () => {
        state.cursor = new Date();
        render();
    });

    document.querySelectorAll('.cal-view-btn').forEach(btn => {
        btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    document.getElementById('cal-day-modal-close').addEventListener('click', closeDayModal);
    document.getElementById('cal-day-modal').addEventListener('click', (e) => {
        if (e.target.id === 'cal-day-modal') closeDayModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDayModal();
    });

    await loadUsers();
    render();
});
