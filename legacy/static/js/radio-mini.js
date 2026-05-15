(() => {
    'use strict';

    // Don't show on the main /radio page (it has its own player UI)
    if (window.location.pathname === '/radio' || window.location.pathname === '/radio/') return;

    const VOL_KEY = 'rd-volume';
    const LAST_KEY = 'rd-last-station';
    const PLAY_KEY = 'rd-playing';
    const DISMISS_KEY = 'rd-mini-dismissed';
    const POS_KEY = 'rd-mini-pos';

    let stations = [];
    let currentStation = null;
    let audio = null;

    function initials(name) {
        return (name || '').split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    }

    function buildWidget() {
        const wrap = document.createElement('div');
        wrap.id = 'rd-mini';
        wrap.className = 'rd-mini';
        wrap.innerHTML = `
            <div class="rd-mini-drag" id="rd-mini-drag" title="Trage pentru a muta" aria-label="Trage pentru a muta">
                <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="3" r="1.2"/><circle cx="7.5" cy="3" r="1.2"/><circle cx="2.5" cy="8" r="1.2"/><circle cx="7.5" cy="8" r="1.2"/><circle cx="2.5" cy="13" r="1.2"/><circle cx="7.5" cy="13" r="1.2"/></svg>
            </div>
            <a class="rd-mini-link" href="/radio" title="Deschide pagina Radio">
                <div class="rd-mini-logo" id="rd-mini-logo"></div>
                <div class="rd-mini-text">
                    <div class="rd-mini-name" id="rd-mini-name"></div>
                    <div class="rd-mini-track" id="rd-mini-track"></div>
                </div>
            </a>
            <button type="button" class="rd-mini-btn rd-mini-play" id="rd-mini-play" aria-label="Play/Pauză" title="Play/Pauză">
                <svg class="rd-mini-icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <svg class="rd-mini-icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>
            <button type="button" class="rd-mini-btn rd-mini-close" id="rd-mini-close" aria-label="Închide widget" title="Ascunde">✕</button>
        `;
        document.body.appendChild(wrap);
        applySavedPosition(wrap);
        setupDrag(wrap);
        return wrap;
    }

    function applySavedPosition(wrap) {
        const saved = localStorage.getItem(POS_KEY);
        if (!saved) return;
        try {
            const { left, top } = JSON.parse(saved);
            const rect = wrap.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width - 4;
            const maxTop = window.innerHeight - rect.height - 4;
            const clampedLeft = Math.max(4, Math.min(left, maxLeft));
            const clampedTop = Math.max(4, Math.min(top, maxTop));
            wrap.style.left = clampedLeft + 'px';
            wrap.style.top = clampedTop + 'px';
            wrap.style.right = 'auto';
            wrap.style.bottom = 'auto';
        } catch (e) { /* ignore */ }
    }

    function setupDrag(wrap) {
        const handle = wrap.querySelector('#rd-mini-drag');
        let startX = 0, startY = 0, origLeft = 0, origTop = 0, dragging = false, moved = false;

        function onPointerDown(e) {
            if (e.button !== undefined && e.button !== 0) return;
            const rect = wrap.getBoundingClientRect();
            origLeft = rect.left;
            origTop = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            dragging = true;
            moved = false;
            wrap.classList.add('dragging');
            wrap.style.left = origLeft + 'px';
            wrap.style.top = origTop + 'px';
            wrap.style.right = 'auto';
            wrap.style.bottom = 'auto';
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
        }

        function onPointerMove(e) {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
            const rect = wrap.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width - 4;
            const maxTop = window.innerHeight - rect.height - 4;
            const newLeft = Math.max(4, Math.min(origLeft + dx, maxLeft));
            const newTop = Math.max(4, Math.min(origTop + dy, maxTop));
            wrap.style.left = newLeft + 'px';
            wrap.style.top = newTop + 'px';
        }

        function onPointerUp(e) {
            if (!dragging) return;
            dragging = false;
            wrap.classList.remove('dragging');
            if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            if (moved) {
                const rect = wrap.getBoundingClientRect();
                localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
            }
        }

        handle.addEventListener('pointerdown', onPointerDown);
        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerUp);

        // Keep inside viewport on resize
        window.addEventListener('resize', () => applySavedPosition(wrap));
    }

    function renderStation(station) {
        const logoEl = document.getElementById('rd-mini-logo');
        const nameEl = document.getElementById('rd-mini-name');
        nameEl.textContent = station.name;
        if (station.logo) {
            logoEl.innerHTML = `<img src="${station.logo}" alt="" onerror="this.parentNode.textContent='${initials(station.name)}'">`;
        } else {
            logoEl.textContent = initials(station.name);
        }
    }

    function setPlayingClass(playing) {
        const w = document.getElementById('rd-mini');
        if (w) w.classList.toggle('playing', playing);
    }

    function streamUrlFor(station) {
        if (station.proxy) return `/api/radio/proxy/${encodeURIComponent(station.id)}`;
        return station.url;
    }

    function startPlayback() {
        if (!currentStation || !audio) return;
        if (!audio.src) audio.src = streamUrlFor(currentStation);
        audio.play().catch(err => {
            console.warn('Mini player autoplay blocked or failed:', err);
            setPlayingClass(false);
            localStorage.setItem(PLAY_KEY, '0');
        });
    }

    function pausePlayback() {
        if (audio) audio.pause();
    }

    function togglePlayback() {
        if (!currentStation || !audio) return;
        if (audio.paused) {
            localStorage.setItem(PLAY_KEY, '1');
            startPlayback();
        } else {
            localStorage.setItem(PLAY_KEY, '0');
            pausePlayback();
        }
    }

    let npTimer = null;
    function fetchNowPlaying() {
        if (!currentStation || !audio || audio.paused) return;
        const id = currentStation.id;
        fetch(`/api/radio/now-playing?id=${encodeURIComponent(id)}`)
            .then(r => r.json())
            .then(data => {
                if (!currentStation || currentStation.id !== id) return;
                const el = document.getElementById('rd-mini-track');
                if (el) el.textContent = (data && data.title) ? data.title : '';
            })
            .catch(() => {});
    }
    function startTrackPolling() {
        if (npTimer) clearInterval(npTimer);
        fetchNowPlaying();
        npTimer = setInterval(fetchNowPlaying, 25000);
    }
    function stopTrackPolling() {
        if (npTimer) { clearInterval(npTimer); npTimer = null; }
        const el = document.getElementById('rd-mini-track');
        if (el) el.textContent = '';
    }

    function attachAudioEvents() {
        audio.addEventListener('playing', () => {
            setPlayingClass(true);
            startTrackPolling();
        });
        audio.addEventListener('pause', () => {
            setPlayingClass(false);
            stopTrackPolling();
        });
        audio.addEventListener('error', () => {
            setPlayingClass(false);
            stopTrackPolling();
            localStorage.setItem(PLAY_KEY, '0');
        });
    }

    function init() {
        const lastId = localStorage.getItem(LAST_KEY);
        if (!lastId) return;
        if (localStorage.getItem(DISMISS_KEY) === '1' && localStorage.getItem(PLAY_KEY) !== '1') return;

        fetch('/api/radio/stations')
            .then(r => r.json())
            .then(data => {
                stations = data.stations || [];
                currentStation = stations.find(s => s.id === lastId);
                if (!currentStation) return;

                buildWidget();
                renderStation(currentStation);

                audio = document.createElement('audio');
                audio.preload = 'none';
                const savedVol = parseInt(localStorage.getItem(VOL_KEY) ?? '80', 10);
                audio.volume = Math.max(0, Math.min(1, savedVol / 100));
                document.body.appendChild(audio);
                attachAudioEvents();

                document.getElementById('rd-mini-play').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePlayback();
                });

                document.getElementById('rd-mini-close').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pausePlayback();
                    localStorage.setItem(PLAY_KEY, '0');
                    localStorage.setItem(DISMISS_KEY, '1');
                    document.getElementById('rd-mini').remove();
                });

                if (localStorage.getItem(PLAY_KEY) === '1') {
                    localStorage.removeItem(DISMISS_KEY);
                    startPlayback();
                }
            })
            .catch(err => console.warn('Mini player init failed:', err));

        // Cross-tab sync: if another tab toggles play state, react
        window.addEventListener('storage', (e) => {
            if (!audio || !currentStation) return;
            if (e.key === PLAY_KEY) {
                if (e.newValue === '1' && audio.paused) startPlayback();
                else if (e.newValue === '0' && !audio.paused) pausePlayback();
            } else if (e.key === LAST_KEY && e.newValue && e.newValue !== currentStation.id) {
                const next = stations.find(s => s.id === e.newValue);
                if (next) {
                    currentStation = next;
                    renderStation(next);
                    audio.src = streamUrlFor(next);
                    if (localStorage.getItem(PLAY_KEY) === '1') startPlayback();
                }
            } else if (e.key === VOL_KEY && e.newValue) {
                audio.volume = Math.max(0, Math.min(1, parseInt(e.newValue, 10) / 100));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
