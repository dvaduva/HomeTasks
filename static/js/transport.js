/* Transport Public — JavaScript */

'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
    routes: [],
    activeRouteIdx: 0,
    activeStation: null,
    dayType: getDodayType(),
    aiOpen: false,
    refreshTimer: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDodayType() {
    const d = new Date().getDay(); // 0=Sun, 6=Sat
    if (d === 0) return 'Duminica';
    if (d === 6) return 'Sambata';
    return 'Lucru';
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Format current date for display (e.g. "19.03"). */
function formatCurrentDate() {
    const d = new Date();
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

function nowMinutes() {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
}

function formatCountdown(diffMin) {
    if (diffMin <= 0) return 'acum';
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Extract all departure times for a station from its schedule object. */
function getStationTimes(stationEntry, dayType) {
    const sched = stationEntry[dayType] || stationEntry['Lucru'] || {};
    const times = [];

    for (const [key, val] of Object.entries(sched)) {
        if (key === 'first_checkpoint' || key === 'second_checkpoint') continue;

        let hourMap = key === 'arrival_times' ? val : val;
        if (typeof hourMap !== 'object' || Array.isArray(hourMap)) continue;

        for (const [hour, mins] of Object.entries(hourMap)) {
            for (const min of mins) {
                times.push({
                    hour: parseInt(hour, 10),
                    minute: parseInt(min, 10),
                    totalMin: parseInt(hour, 10) * 60 + parseInt(min, 10),
                    label: `${pad2(parseInt(hour,10))}:${min}`,
                    dest: key === 'arrival_times' ? '' : key.replace(/_\d+$/, ''),
                });
            }
        }
    }

    times.sort((a, b) => a.totalMin - b.totalMin);
    // Deduplicate same minute (different checkpoint groups)
    const seen = new Set();
    return times.filter(t => {
        if (seen.has(t.totalMin)) return false;
        seen.add(t.totalMin);
        return true;
    });
}

// ── Clock & Day badge ────────────────────────────────────────────────────────

function updateClock() {
    const now = new Date();
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    document.getElementById('tp-clock').textContent = timeStr;
}

function initClock() {
    updateClock();
    setInterval(updateClock, 1000);
}

// ── Init & Data load ─────────────────────────────────────────────────────────

async function loadRoutes() {
    try {
        const res = await fetch('/api/transport/routes');
        if (!res.ok) throw new Error('Failed to load routes');
        state.routes = await res.json();
        renderRouteTabs();
        selectRoute(0);
    } catch (e) {
        document.getElementById('route-tabs').innerHTML =
            `<p style="color:#dc2626;padding:12px;font-size:13px">Eroare la încărcarea datelor: ${e.message}</p>`;
    }
}

// ── Route tabs ───────────────────────────────────────────────────────────────

function renderRouteTabs() {
    const container = document.getElementById('route-tabs');
    container.innerHTML = '';
    state.routes.forEach((route, idx) => {
        const [from, to] = route.direction.split(' -> ');
        const btn = document.createElement('button');
        btn.className = 'tp-route-tab' + (idx === state.activeRouteIdx ? ' active' : '');
        btn.innerHTML = `
            <span class="tp-route-num">${route.route}</span>
            <span class="tp-route-dir">
                <strong>${from}</strong><br>→ ${to}
            </span>`;
        btn.addEventListener('click', () => selectRoute(idx));
        container.appendChild(btn);
    });
}

function selectRoute(idx) {
    state.activeRouteIdx = idx;
    state.activeStation = null;
    document.querySelectorAll('.tp-route-tab').forEach((el, i) =>
        el.classList.toggle('active', i === idx));
    renderStationList();
    showPlaceholder();
}

// ── Station list ─────────────────────────────────────────────────────────────

function renderStationList() {
    const container = document.getElementById('station-list');
    const route = state.routes[state.activeRouteIdx];
    if (!route) { container.innerHTML = '<p class="tp-empty">Nicio rută.</p>'; return; }

    const stations = route.stations_order;
    container.innerHTML = '';

    stations.forEach((name, idx) => {
        const item = document.createElement('div');
        item.className = 'tp-station-item' + (name === state.activeStation ? ' active' : '');
        item.dataset.station = name;

        const isFirst = idx === 0;
        const isLast = idx === stations.length - 1;
        const hasData = name in (route.departures || {});

        item.innerHTML = `
            <div class="tp-station-line">
                ${!isFirst ? '<div class="tp-station-connector"></div>' : ''}
                <div class="tp-station-dot"></div>
                ${!isLast ? '<div class="tp-station-connector"></div>' : ''}
            </div>
            <div class="tp-station-name" style="${!hasData ? 'opacity:.5' : ''}">${name}</div>`;

        if (hasData) {
            item.addEventListener('click', () => selectStation(name));
            item.style.cursor = 'pointer';
        }
        container.appendChild(item);
    });
}

function selectStation(name) {
    state.activeStation = name;
    document.querySelectorAll('.tp-station-item').forEach(el =>
        el.classList.toggle('active', el.dataset.station === name));
    renderContent();
    scheduleRefresh();
}

// ── Content area ─────────────────────────────────────────────────────────────

function showPlaceholder() {
    document.getElementById('tp-content').innerHTML = `
        <div class="tp-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3">
                <rect x="1" y="3" width="15" height="13" rx="2"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <p>Selectați o stație pentru<br>a vedea programul.</p>
        </div>`;
}

function renderContent() {
    const route = state.routes[state.activeRouteIdx];
    if (!route || !state.activeStation) { showPlaceholder(); return; }

    const stationEntry = route.departures[state.activeStation];
    if (!stationEntry) { showPlaceholder(); return; }

    const times = getStationTimes(stationEntry, state.dayType);
    const content = document.getElementById('tp-content');

    content.innerHTML = `
        ${renderStationHeaderHTML(route)}
        ${renderNextBusesHTML(times, route)}
        ${renderScheduleHTML(times)}`;

    scrollScheduleToCurrentHour();
}

function renderStationHeaderHTML(route) {
    const [, to] = route.direction.split(' -> ');
    return `
        <div class="tp-station-header">
            <div class="tp-station-header-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                </svg>
            </div>
            <div class="tp-station-header-info">
                <div class="tp-station-header-name">${state.activeStation}</div>
                <div class="tp-station-header-route">Linia ${route.route} → ${to} · ${state.dayType}</div>
            </div>
        </div>`;
}

function renderNextBusesHTML(times, route) {
    const now = nowMinutes();
    const upcoming = times.filter(t => t.totalMin >= now).slice(0, 6);
    const [, routeTerminus = ''] = (route && route.direction ? route.direction.split(' -> ') : []);

    let rows = '';
    if (upcoming.length === 0) {
        rows = `<div class="tp-no-buses">Nu mai sunt curse astăzi din această stație.</div>`;
    } else {
        rows = upcoming.map(t => {
            const diff = t.totalMin - now;
            let badgeClass, badgeText;
            if (diff <= 2) { badgeClass = 'tp-badge-now'; badgeText = 'acum'; }
            else if (diff <= 15) { badgeClass = 'tp-badge-soon'; badgeText = formatCountdown(diff); }
            else { badgeClass = 'tp-badge-later'; badgeText = formatCountdown(diff); }

            return `
                <div class="tp-next-bus-row">
                    <div class="tp-next-bus-time">${t.label}</div>
                    <div class="tp-next-bus-badge ${badgeClass}">${badgeText}</div>
                    ${routeTerminus ? `<div class="tp-next-bus-dest">→ ${routeTerminus}</div>` : ''}
                </div>`;
        }).join('');
    }

    return `
        <div class="tp-next-card">
            <div class="tp-next-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                Următoarele curse
            </div>
            <div class="tp-next-buses">${rows}</div>
        </div>`;
}

function renderScheduleHTML(times) {
    if (times.length === 0) {
        return `<div class="tp-schedule-card"><div class="tp-no-buses">Program indisponibil pentru această zi.</div></div>`;
    }

    const now = nowMinutes();
    const currentHour = new Date().getHours();

    // Group by hour
    const byHour = {};
    for (const t of times) {
        if (!byHour[t.hour]) byHour[t.hour] = [];
        byHour[t.hour].push(t);
    }

    // Find the very next bus for highlighting
    const nextBus = times.find(t => t.totalMin >= now);

    let rows = '';
    const currentDateStr = formatCurrentDate();
    for (const [hour, hTimes] of Object.entries(byHour)) {
        const h = parseInt(hour, 10);
        const isCurrent = h === currentHour;
        const rowClass = isCurrent ? 'tp-current-hour' : '';
        const hourCell = isCurrent
            ? `<div class="tp-hour-main">${pad2(h)}</div><div class="tp-hour-date">${currentDateStr}</div>`
            : pad2(h);

        const chips = hTimes.map(t => {
            const isPastChip = t.totalMin < now;
            const isNextChip = nextBus && t.totalMin === nextBus.totalMin;
            const isSoon = !isPastChip && !isNextChip && t.totalMin - now <= 15;
            let chipClass = '';
            if (isPastChip) chipClass = 'tp-chip-past';
            else if (isNextChip) chipClass = 'tp-chip-next';
            else if (isSoon) chipClass = 'tp-chip-soon';
            return `<span class="tp-min-chip ${chipClass}">${pad2(t.minute)}</span>`;
        }).join('');

        rows += `
            <tr class="${rowClass}">
                <td class="tp-hour-cell">${hourCell}</td>
                <td><div class="tp-mins-cell">${chips}</div></td>
            </tr>`;
    }

    return `
        <div class="tp-schedule-card">
            <div class="tp-schedule-header">
                <span>Program complet</span>
                <span>${times.length} curse</span>
            </div>
            <div class="tp-schedule-scroll">
                <table class="tp-schedule-table">
                    <thead>
                        <tr>
                            <th>Ora</th>
                            <th>Minute</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>`;
}

function scrollScheduleToCurrentHour() {
    const scrollEl = document.querySelector('.tp-schedule-scroll');
    const currentRow = scrollEl ? scrollEl.querySelector('tr.tp-current-hour') : null;
    if (!scrollEl || !currentRow) return;

    // Wait one frame so layout is ready, then center current hour row.
    requestAnimationFrame(() => {
        const rowOffsetTop = currentRow.offsetTop;
        const target = rowOffsetTop - (scrollEl.clientHeight / 2) + (currentRow.offsetHeight / 2);
        scrollEl.scrollTop = Math.max(0, target);
    });
}

// ── Day type selector ─────────────────────────────────────────────────────────

function initDaySelector() {
    const dayType = getDodayType();
    state.dayType = dayType;

    // Set active button
    document.querySelectorAll('.tp-day-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.day === dayType);
    });

    // Update day badge
    const labels = { Lucru: 'Zi Lucrătoare', Sambata: 'Sâmbătă', Duminica: 'Duminică' };
    document.getElementById('day-badge').textContent = labels[dayType] || dayType;

    document.querySelectorAll('.tp-day-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.dayType = btn.dataset.day;
            document.querySelectorAll('.tp-day-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.day === state.dayType));
            document.getElementById('day-badge').textContent = labels[state.dayType] || state.dayType;
            if (state.activeStation) renderContent();
        });
    });
}

// ── Auto-refresh ─────────────────────────────────────────────────────────────

function scheduleRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
        if (state.activeStation) renderContent();
    }, 30000);
}

// ── AI Panel ─────────────────────────────────────────────────────────────────

function openAiPanel() {
    const panel = document.getElementById('ai-panel');
    const toggleBtn = document.getElementById('ai-toggle-btn');
    const input = document.getElementById('ai-input');
    if (!panel || !toggleBtn) return;
    state.aiOpen = true;
    panel.classList.add('open');
    toggleBtn.classList.add('active');
    setTimeout(() => input && input.focus(), 300);
}

function initAiPanel() {
    const panel = document.getElementById('ai-panel');
    const toggleBtn = document.getElementById('ai-toggle-btn');
    const closeBtn = document.getElementById('ai-close-btn');
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');

    function closePanel() {
        state.aiOpen = false;
        panel.classList.remove('open');
        toggleBtn.classList.remove('active');
    }

    toggleBtn.addEventListener('click', () => state.aiOpen ? closePanel() : openAiPanel());
    closeBtn.addEventListener('click', closePanel);

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        if (e.key === 'Escape') closePanel();
    });
    sendBtn.addEventListener('click', sendMessage);

    // Enable click-to-speak for the initial assistant message (static HTML)
    const bubbles = document.querySelectorAll('#ai-messages .tp-ai-assistant .tp-ai-bubble');
    bubbles.forEach(wireAiBubbleTts);
}

function wireAiBubbleTts(bubbleEl) {
    if (!bubbleEl || bubbleEl.dataset.ttsBound === '1') return;
    bubbleEl.dataset.ttsBound = '1';
    bubbleEl.title = 'Click pentru a asculta mesajul';
    bubbleEl.addEventListener('click', () => speakTransportText(bubbleEl.innerText || bubbleEl.textContent || ''));
}

function addAiMessage(text, role) {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = `tp-ai-msg tp-ai-${role}`;
    div.innerHTML = `<div class="tp-ai-bubble">${escapeHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (role === 'assistant') {
        const bubble = div.querySelector('.tp-ai-bubble');
        wireAiBubbleTts(bubble);
    }
    return div;
}

function addAiThinking() {
    const container = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = 'tp-ai-msg tp-ai-assistant tp-ai-thinking';
    div.innerHTML = `<div class="tp-ai-bubble">Se gândește…</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
}

async function sendMessage() {
    const input = document.getElementById('ai-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    sendBtn.disabled = true;

    addAiMessage(message, 'user');
    const thinking = addAiThinking();

    const route = state.routes[state.activeRouteIdx];
    const now = new Date();
    const currentTime = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    try {
        const res = await fetch('/api/transport/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                route: route ? route.direction : '',
                station: state.activeStation || '',
                dayType: state.dayType,
                currentTime,
            })
        });

        const data = await res.json();
        thinking.remove();

        if (data.error) {
            addAiMessage(`Eroare: ${data.error}`, 'assistant');
        } else {
            addAiMessage(data.response || '(fără răspuns)', 'assistant');
        }
    } catch (e) {
        thinking.remove();
        addAiMessage(`Eroare de conexiune: ${e.message}`, 'assistant');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

// ── Voice (microphone) ───────────────────────────────────────────────────────

const VOICE_STRINGS = {
    inactive: 'Inactiv',
    available: 'Disponibil',
    listening: 'Ascult...',
    mic_unavailable: 'Microfon indisponibil',
    mic_denied: 'Acces refuzat',
    heard: 'Am auzit: ',
    error: 'Eroare recunoaștere',
};

let voiceLanguage = 'ro-RO';
let serverMicAvailable = false;
let serverTtsAvailable = false;
let currentServerTtsAudio = null;
let voiceListening = false;
let currentRecognition = null;

function showVoiceFeedback(message, isError) {
    const existing = document.querySelector('.tp-voice-feedback');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'tp-voice-feedback';
    if (isError) el.setAttribute('data-error', 'true');
    el.textContent = message;
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function updateVoiceUI(listening) {
    const btn = document.getElementById('tp-voice-btn');
    const status = document.getElementById('tp-voice-status');
    if (btn) {
        btn.classList.toggle('listening', listening);
        btn.title = listening ? 'Oprește ascultarea' : 'Comandă vocală';
    }
    if (status) status.textContent = listening ? VOICE_STRINGS.listening : VOICE_STRINGS.available;
}

function processTransportVoiceCommand(text) {
    if (!text || !text.trim()) return;
    openAiPanel();
    const input = document.getElementById('ai-input');
    if (input) {
        input.value = text.trim();
        sendMessage();
    }
    showVoiceFeedback(VOICE_STRINGS.heard + text.trim(), false);
}

// Speak assistant messages (server TTS when available; else browser speechSynthesis)
function speakTransportText(text) {
    const clean = (text || '').trim();
    if (!clean) return null;

    if (serverTtsAvailable) {
        if (currentServerTtsAudio) {
            try { currentServerTtsAudio.pause(); } catch (e) {}
            currentServerTtsAudio = null;
        }
        const fakeUtterance = { onend: null, onerror: null };
        fetch('/api/voice/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean, lang: voiceLanguage })
        }).then(r => {
            if (!r.ok) throw new Error('TTS failed');
            return r.blob();
        }).then(blob => {
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            currentServerTtsAudio = audio;
            audio.addEventListener('ended', () => {
                currentServerTtsAudio = null;
                URL.revokeObjectURL(url);
                if (fakeUtterance.onend) fakeUtterance.onend();
            });
            audio.addEventListener('error', () => {
                currentServerTtsAudio = null;
                URL.revokeObjectURL(url);
                if (fakeUtterance.onerror) fakeUtterance.onerror();
            });
            audio.play();
        }).catch(() => {
            if (fakeUtterance.onerror) fakeUtterance.onerror();
        });
        return fakeUtterance;
    }

    if (!window.speechSynthesis) return null;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = voiceLanguage;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
    return utter;
}

function initVoice() {
    const voiceBtn = document.getElementById('tp-voice-btn');
    const voiceStatusEl = document.getElementById('tp-voice-status');
    if (!voiceBtn) return;

    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    Promise.all([
        fetch('/api/preferences').then(r => r.json()).catch(() => ({})),
        fetch('/api/voice/server-available').then(r => r.json()).catch(() => ({ available: false, tts_available: false }))
    ]).then(([prefs, serverData]) => {
        voiceLanguage = (prefs.voice_language || 'ro-RO').trim() || 'ro-RO';
        serverMicAvailable = serverData.available === true;
        serverTtsAvailable = serverData.tts_available === true;

        if (!window.SpeechRecognition && !serverMicAvailable) {
            voiceBtn.disabled = true;
            voiceBtn.setAttribute('aria-disabled', 'true');
            if (voiceStatusEl) voiceStatusEl.textContent = VOICE_STRINGS.mic_unavailable;
            return;
        }
        if (voiceStatusEl) voiceStatusEl.textContent = VOICE_STRINGS.available;
    });

    voiceBtn.addEventListener('click', function () {
        if (voiceListening) {
            if (currentRecognition) {
                try { currentRecognition.stop(); } catch (e) {}
                currentRecognition = null;
            }
            voiceListening = false;
            updateVoiceUI(false);
            return;
        }

        if (serverMicAvailable) {
            voiceListening = true;
            updateVoiceUI(true);
            showVoiceFeedback(VOICE_STRINGS.listening, false);
            fetch('/api/voice/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: voiceLanguage })
            })
                .then(r => r.json())
                .then(data => {
                    voiceListening = false;
                    updateVoiceUI(false);
                    if (data.text && data.text.trim()) {
                        processTransportVoiceCommand(data.text);
                    } else {
                        showVoiceFeedback(data.error || VOICE_STRINGS.error, true);
                    }
                })
                .catch(err => {
                    voiceListening = false;
                    updateVoiceUI(false);
                    showVoiceFeedback(VOICE_STRINGS.error + (err.message || ''), true);
                });
            return;
        }

        if (!window.SpeechRecognition) {
            showVoiceFeedback(VOICE_STRINGS.mic_unavailable, true);
            return;
        }

        try {
            currentRecognition = new SpeechRecognition();
            currentRecognition.continuous = false;
            currentRecognition.interimResults = false;
            currentRecognition.lang = voiceLanguage;

            currentRecognition.onresult = function (event) {
                const transcript = (event.results[0] && event.results[0][0]) ? event.results[0][0].transcript.trim() : '';
                if (transcript) processTransportVoiceCommand(transcript);
                voiceListening = false;
                updateVoiceUI(false);
                currentRecognition = null;
            };

            currentRecognition.onerror = function (event) {
                voiceListening = false;
                updateVoiceUI(false);
                currentRecognition = null;
                if (event.error === 'not-allowed' && voiceStatusEl) voiceStatusEl.textContent = VOICE_STRINGS.mic_denied;
                if (event.error !== 'aborted' && event.error !== 'no-speech') {
                    showVoiceFeedback(VOICE_STRINGS.error + (event.error || ''), true);
                }
            };

            currentRecognition.onend = function () {
                if (currentRecognition) {
                    voiceListening = false;
                    updateVoiceUI(false);
                    currentRecognition = null;
                }
            };

            currentRecognition.start();
            voiceListening = true;
            updateVoiceUI(true);
            showVoiceFeedback(VOICE_STRINGS.listening, false);
        } catch (err) {
            showVoiceFeedback(VOICE_STRINGS.error, true);
            voiceListening = false;
            updateVoiceUI(false);
            currentRecognition = null;
        }
    });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initDaySelector();
    initAiPanel();
    initVoice();
    loadRoutes();
});
