(() => {
    'use strict';

    const audio = document.getElementById('rd-audio');
    const stationsEl = document.getElementById('rd-stations');
    const nowPlayingEl = document.getElementById('rd-now-playing');
    const npIconEl = document.getElementById('rd-np-icon');
    const npNameEl = document.getElementById('rd-np-name');
    const npStatusEl = document.getElementById('rd-np-status');
    const npTrackEl = document.getElementById('rd-np-track');
    const btnPlay = document.getElementById('rd-btn-play');
    const btnMute = document.getElementById('rd-btn-mute');
    const volumeEl = document.getElementById('rd-volume');
    const clockEl = document.getElementById('rd-clock');

    const DEFAULT_NP_ICON = npIconEl.innerHTML;

    function setNowPlayingLogo(station) {
        if (!station) {
            npIconEl.innerHTML = DEFAULT_NP_ICON;
            return;
        }
        if (station.logo) {
            const safeName = (station.name || '').replace(/'/g, "\\'");
            npIconEl.innerHTML = `<img src="${station.logo}" alt="${station.name || ''}" onerror="this.parentNode.textContent='${initials(station.name || '')}'">`;
        } else {
            npIconEl.textContent = initials(station.name || '');
        }
    }

    const VOL_KEY = 'rd-volume';
    const LAST_KEY = 'rd-last-station';
    const FAV_KEY = 'rd-favorites';
    const PLAY_KEY = 'rd-playing';
    const DISMISS_KEY = 'rd-mini-dismissed';

    let stations = [];
    let currentId = null;
    let favorites = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));

    function saveFavorites() {
        localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
    }

    function isFavorite(id) {
        return favorites.has(id);
    }

    function toggleFavorite(id) {
        if (favorites.has(id)) favorites.delete(id);
        else favorites.add(id);
        saveFavorites();
    }

    // ── Clock ──
    function updateClock() {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        clockEl.textContent = `${hh}:${mm}`;
    }
    updateClock();
    setInterval(updateClock, 30000);

    // ── Volume persistence ──
    const savedVol = parseInt(localStorage.getItem(VOL_KEY) ?? '80', 10);
    volumeEl.value = String(savedVol);
    audio.volume = Math.max(0, Math.min(1, savedVol / 100));

    volumeEl.addEventListener('input', () => {
        const v = parseInt(volumeEl.value, 10);
        audio.volume = v / 100;
        localStorage.setItem(VOL_KEY, String(v));
        if (v === 0) {
            btnMute.classList.add('muted');
        } else {
            btnMute.classList.remove('muted');
        }
    });

    btnMute.addEventListener('click', () => {
        if (audio.volume > 0) {
            volumeEl.dataset.prev = String(volumeEl.value);
            volumeEl.value = '0';
            audio.volume = 0;
            btnMute.classList.add('muted');
        } else {
            const prev = parseInt(volumeEl.dataset.prev || '80', 10);
            volumeEl.value = String(prev);
            audio.volume = prev / 100;
            btnMute.classList.remove('muted');
        }
    });

    // ── Render stations ──
    function initials(name) {
        return name.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
    }

    function sortedStations() {
        return [...stations].sort((a, b) => {
            const fa = isFavorite(a.id) ? 0 : 1;
            const fb = isFavorite(b.id) ? 0 : 1;
            return fa - fb;
        });
    }

    function renderStations() {
        if (!stations.length) {
            stationsEl.innerHTML = '<p class="rd-empty">Nu există posturi configurate.</p>';
            return;
        }
        stationsEl.innerHTML = '';
        sortedStations().forEach(s => {
            const card = document.createElement('div');
            card.className = 'rd-station';
            card.dataset.id = s.id;
            if (isFavorite(s.id)) card.classList.add('favorite');
            card.innerHTML = `
                <button type="button" class="rd-station-main" aria-label="Redă ${s.name.replace(/"/g, '&quot;')}">
                    <div class="rd-station-logo">${s.logo ? `<img src="${s.logo}" alt="" onerror="this.parentNode.textContent='${initials(s.name)}'">` : initials(s.name)}</div>
                    <div class="rd-station-info">
                        <div class="rd-station-name"></div>
                        <div class="rd-station-genre"></div>
                    </div>
                    <svg class="rd-station-playing-indicator" viewBox="0 0 12 12">
                        <rect class="bar" x="1" y="2" width="2" height="8"/>
                        <rect class="bar" x="5" y="2" width="2" height="8"/>
                        <rect class="bar" x="9" y="2" width="2" height="8"/>
                    </svg>
                </button>
                <button type="button" class="rd-station-fav" aria-label="Favorit" title="Adaugă/scoate din favorite">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
            `;
            card.querySelector('.rd-station-name').textContent = s.name;
            card.querySelector('.rd-station-genre').textContent = s.genre || s.description || '';
            card.querySelector('.rd-station-main').addEventListener('click', () => onStationClick(s));
            card.querySelector('.rd-station-fav').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(s.id);
                renderStations();
                setActiveCard(currentId);
            });
            stationsEl.appendChild(card);
        });
    }

    function setActiveCard(id) {
        document.querySelectorAll('.rd-station').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
            el.classList.toggle('playing', el.dataset.id === id && !audio.paused);
        });
    }

    function streamUrlFor(station) {
        if (station.proxy) return `/api/radio/proxy/${encodeURIComponent(station.id)}`;
        return station.url;
    }

    // ── Playback ──
    function play(station) {
        currentId = station.id;
        npNameEl.textContent = station.name;
        npStatusEl.textContent = 'Se conectează...';
        npStatusEl.className = 'rd-np-status loading';
        npTrackEl.textContent = '';
        setNowPlayingLogo(station);
        btnPlay.disabled = false;

        audio.src = streamUrlFor(station);
        audio.play().catch(err => {
            console.warn('Audio play failed:', err);
            if (err && err.name === 'NotAllowedError') {
                npStatusEl.textContent = 'Apăsați play pentru a relua redarea';
                npStatusEl.className = 'rd-np-status';
            } else {
                npStatusEl.textContent = 'Eroare la redare. Verificați adresa stream-ului.';
                npStatusEl.className = 'rd-np-status error';
            }
            nowPlayingEl.classList.remove('playing');
            stopNowPlayingPolling();
            setActiveCard(currentId);
        });

        setActiveCard(currentId);
        localStorage.setItem(LAST_KEY, station.id);
    }

    // ── Now-playing (ICY metadata) polling ──
    let npTimer = null;

    function stopNowPlayingPolling() {
        if (npTimer) {
            clearInterval(npTimer);
            npTimer = null;
        }
        npTrackEl.textContent = '';
    }

    function fetchNowPlaying() {
        if (!currentId) return;
        const requestedId = currentId;
        fetch(`/api/radio/now-playing?id=${encodeURIComponent(currentId)}`)
            .then(r => r.json())
            .then(data => {
                if (requestedId !== currentId || audio.paused) return;
                if (data && data.title) {
                    npTrackEl.textContent = data.title;
                } else {
                    npTrackEl.textContent = '';
                }
            })
            .catch(() => {});
    }

    function startNowPlayingPolling() {
        stopNowPlayingPolling();
        fetchNowPlaying();
        npTimer = setInterval(fetchNowPlaying, 20000);
    }

    function togglePlayPause() {
        if (!currentId) return;
        if (audio.paused) {
            audio.play().catch(() => {});
        } else {
            audio.pause();
        }
    }

    function onStationClick(station) {
        localStorage.setItem(PLAY_KEY, '1');
        localStorage.removeItem(DISMISS_KEY);
        if (station.id === currentId && !audio.paused) {
            audio.pause();
            localStorage.setItem(PLAY_KEY, '0');
            return;
        }
        if (station.id === currentId && audio.paused && audio.src) {
            audio.play().catch(() => {});
            return;
        }
        play(station);
    }

    btnPlay.addEventListener('click', () => {
        if (!currentId) return;
        if (audio.paused) {
            localStorage.setItem(PLAY_KEY, '1');
            localStorage.removeItem(DISMISS_KEY);
        } else {
            localStorage.setItem(PLAY_KEY, '0');
        }
        togglePlayPause();
    });

    // ── Audio events ──
    audio.addEventListener('playing', () => {
        nowPlayingEl.classList.add('playing');
        npStatusEl.textContent = 'În redare ●';
        npStatusEl.className = 'rd-np-status';
        setActiveCard(currentId);
        startNowPlayingPolling();
    });

    audio.addEventListener('pause', () => {
        nowPlayingEl.classList.remove('playing');
        if (currentId) {
            npStatusEl.textContent = 'În pauză';
            npStatusEl.className = 'rd-np-status';
        }
        setActiveCard(currentId);
        stopNowPlayingPolling();
    });

    audio.addEventListener('waiting', () => {
        npStatusEl.textContent = 'Se încarcă...';
        npStatusEl.className = 'rd-np-status loading';
    });

    audio.addEventListener('error', () => {
        npStatusEl.textContent = 'Eroare: stream indisponibil sau format neacceptat.';
        npStatusEl.className = 'rd-np-status error';
        nowPlayingEl.classList.remove('playing');
        setActiveCard(currentId);
        stopNowPlayingPolling();
    });

    // ── Load stations ──
    fetch('/api/radio/stations')
        .then(r => r.json())
        .then(data => {
            stations = data.stations || [];
            renderStations();
            const lastId = localStorage.getItem(LAST_KEY);
            if (lastId) {
                const last = stations.find(s => s.id === lastId);
                if (last) {
                    if (localStorage.getItem(PLAY_KEY) === '1') {
                        play(last);
                    } else {
                        currentId = last.id;
                        npNameEl.textContent = last.name;
                        npStatusEl.textContent = 'Apăsați play pentru a porni';
                        setNowPlayingLogo(last);
                        btnPlay.disabled = false;
                        setActiveCard(currentId);
                    }
                }
            }
        })
        .catch(err => {
            console.error('Failed to load stations:', err);
            stationsEl.innerHTML = '<p class="rd-empty">Nu s-a putut încărca lista de posturi.</p>';
        });
})();
