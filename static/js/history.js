let historyUsersCache = [];

function updateHistoryClock() {
    const el = document.getElementById('history-clock');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function toLocalISOString(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRecurrenceLabel(pattern) {
    const labels = {
        daily: 'Zilnic',
        weekly: 'Săptămânal',
        monthly: 'Lunar',
        yearly: 'Anual',
    };
    return labels[pattern] || pattern;
}

function populateHistoryUserFilter() {
    fetch('/api/users')
        .then(r => r.json())
        .then(users => {
            historyUsersCache = Array.isArray(users) ? users : [];
            const sel = document.getElementById('history-user-filter');
            if (!sel) return;
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">Toți utilizatorii</option>' +
                historyUsersCache.map(u => `<option value="${u.id}"${String(currentVal) === String(u.id) ? ' selected' : ''}>${escapeHtml(u.name)}</option>`).join('');
        })
        .catch(() => {});
}

function loadHistoryTasks() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="empty">Se încarcă...</p>';

    const userId = document.getElementById('history-user-filter')?.value || '';
    const status = document.getElementById('history-status-filter')?.value || '';
    const days = parseInt(document.getElementById('history-period-filter')?.value ?? '30', 10);

    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (status) params.set('status', status);
    if (days > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        params.set('start_date', toLocalISOString(startDate));
    }

    fetch(`/api/tasks?${params.toString()}`)
        .then(r => r.json())
        .then(tasks => renderHistoryTasks(Array.isArray(tasks) ? tasks : []))
        .catch(() => {
            listEl.innerHTML = '<p class="empty">Eroare la încărcare.</p>';
        });
}

function renderHistoryTasks(tasks) {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;

    if (!tasks.length) {
        listEl.innerHTML = '<p class="empty">Nu există taskuri în această perioadă.</p>';
        return;
    }

    const userMap = {};
    historyUsersCache.forEach(u => {
        userMap[u.id] = u;
    });

    const groups = {};
    tasks.forEach(task => {
        const d = task.scheduled_date ? new Date(task.scheduled_date) : null;
        const key = d ? d.toLocaleDateString('ro-RO', { year: 'numeric', month: 'long' }) : 'Fără dată';
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
    });

    const statusLabels = {
        completed: 'Finalizat',
        refused: 'Refuzat',
        pending: 'În așteptare',
    };

    let html = '';
    for (const [month, monthTasks] of Object.entries(groups)) {
        html += `<div class="history-group-header">${escapeHtml(month)} <span style="font-weight:400;opacity:.7">(${monthTasks.length})</span></div>`;

        monthTasks.forEach(task => {
            const statusValue = task.status || 'pending';
            const user = userMap[task.user_id];
            const dateStr = task.scheduled_date
                ? new Date(task.scheduled_date).toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
                : '—';
            const userHtml = user
                ? `<span><span class="history-user-dot" style="background:${escapeHtml(user.color || '#64748b')}"></span>${escapeHtml(user.name)}</span>`
                : '';
            const recurrenceHtml = task.recurrence_pattern && task.recurrence_pattern !== 'none'
                ? `<span>${escapeHtml(getRecurrenceLabel(task.recurrence_pattern))}</span>`
                : '';
            const commentsHtml = Number(task.comment_count || 0) > 0
                ? `<span>💬 ${Number(task.comment_count)}</span>`
                : '';

            html += `
                <div class="history-task ${escapeHtml(statusValue)}" data-task-id="${Number(task.id)}">
                    <div class="history-status-dot ${escapeHtml(statusValue)}"></div>
                    <div class="history-task-body">
                        <div class="history-task-desc">${escapeHtml(task.description || '')}</div>
                        <div class="history-task-meta">
                            <span>${escapeHtml(dateStr)}</span>
                            ${userHtml}
                            <span>${escapeHtml(statusLabels[statusValue] || statusValue)}</span>
                            ${recurrenceHtml}
                            ${commentsHtml}
                        </div>
                    </div>
                </div>`;
        });
    }

    listEl.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    updateHistoryClock();
    setInterval(updateHistoryClock, 1000);
    populateHistoryUserFilter();
    loadHistoryTasks();

    ['history-user-filter', 'history-status-filter', 'history-period-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadHistoryTasks);
    });
});
