// Main JavaScript for HomeTasks frontend - Faza 7: Interfața de gestionare a taskurilor
// Faza 8: Interfața vocală (client-side)

// Global voice preferences object
const voicePrefs = {
    language: 'ro-RO',  // Default language
    sensitivity: 0.5    // Default sensitivity
};

// Initialize voice recognition
function initVoiceRecognition() {
    // Check if SpeechRecognition is available
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    const voiceStatus = document.getElementById('voice-status');

    if (!window.SpeechRecognition) {
        console.warn('SpeechRecognition not supported in this browser');
        document.getElementById('voice-btn').title = 'Recunoașterea vocală nu este disponibilă în acest browser';
        document.getElementById('voice-btn').style.opacity = '0.5';
        document.getElementById('voice-btn').style.cursor = 'not-allowed';
        voiceStatus.textContent = 'Microfon: indisponibil';
        return;
    }

    voiceStatus.textContent = 'Microfon: disponibil';

    let isListening = false;
    let currentRecognition = null;
    
    // Update button state
    function updateVoiceButton(listening) {
        const voiceBtn = document.getElementById('voice-btn');
        const label = document.getElementById('voice-btn-label');
        if (listening) {
            if (label) label.textContent = 'Ascult...';
            voiceBtn.style.removeProperty('background-color');
            voiceBtn.classList.add('listening');
            voiceBtn.title = 'Oprire ascultare';
            voiceStatus.textContent = 'Ascult...';
        } else {
            if (label) label.textContent = 'Comandă Vocală';
            voiceBtn.style.removeProperty('background-color');
            voiceBtn.classList.remove('listening');
            voiceBtn.title = 'Pornește ascultarea';
            voiceStatus.textContent = 'Disponibil';
        }
    }
    
    // Voice button click handler
    document.getElementById('voice-btn').addEventListener('click', function() {
        if (!isListening) {
            // Start listening
            try {
                currentRecognition = new SpeechRecognition();
                currentRecognition.continuous = false;
                currentRecognition.interimResults = false;
                currentRecognition.lang = voicePrefs.language; // Use the language from prefs
                
                currentRecognition.onresult = function(event) {
                    const transcript = event.results[0][0].transcript.trim();
                    console.log('Voice command received:', transcript);
                    
                    // Process the voice command
                    processVoiceCommand(transcript);
                    
                    // Stop listening after getting a result
                    if (currentRecognition) {
                        currentRecognition.stop();
                    }
                    isListening = false;
                    updateVoiceButton(isListening);
                    currentRecognition = null;
                };
                
                currentRecognition.onerror = function(event) {
                    console.error('Speech recognition error:', event.error);
                    isListening = false;
                    updateVoiceButton(isListening);
                    if (currentRecognition) {
                        currentRecognition = null;
                    }
                    
                    if (event.error === 'not-allowed') {
                        voiceStatus.textContent = 'Microfon: acces refuzat';
                    }
                    // Show error feedback
                    showVoiceFeedback('Eroare la recunoașterea vorbirii: ' + event.error, true);
                };
                
                currentRecognition.onend = function() {
                    isListening = false;
                    updateVoiceButton(isListening);
                    currentRecognition = null;
                };
                
                // Start listening
                currentRecognition.start();
                isListening = true;
                updateVoiceButton(isListening);
                
                showVoiceFeedback('Ascult... Vorbesc acum', false);
            } catch (err) {
                console.error('Error starting speech recognition:', err);
                showVoiceFeedback('Eroare la pornirea recunoașterii vocale', true);
                if (currentRecognition) {
                    currentRecognition = null;
                }
                isListening = false;
                updateVoiceButton(isListening);
            }
        } else {
            // Stop listening
            if (currentRecognition) {
                currentRecognition.stop();
            }
            isListening = false;
            updateVoiceButton(isListening);
            currentRecognition = null;
            showVoiceFeedback('Oprire ascultare', false);
        }
    });
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString('ro-RO', options);
    const timeString = now.toLocaleTimeString('ro-RO');
    document.getElementById('date-time').textContent = `${dateString}, ${timeString}`;
}

function loadUsers() {
    fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            const userList = document.getElementById('user-list');
            userList.innerHTML = '';
            
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.dataset.userId = user.id;
                userElement.innerHTML = `
                    <div class="user-color" style="background-color: ${user.color}"></div>
                    <span>${user.name}</span>
                `;
                userList.appendChild(userElement);
            });
            
            // Select first user by default
            if (users.length > 0) {
                const firstUser = userList.firstChild;
                if (firstUser) {
                    firstUser.classList.add('active');
                    loadTasksForUser(firstUser.dataset.userId);
                }
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            document.getElementById('user-list').innerHTML = '<p>Eroare la încărcarea utilizatorilor</p>';
        });
}

function loadTasksForUser(userId) {
    // Clear immediately so old tasks don't linger while loading
    document.getElementById('tasks-list').innerHTML = '<p>Se încarcă...</p>';

    fetch(`/api/tasks?user_id=${userId}`)
        .then(response => response.json())
        .then(tasks => {
            // Update tasks display
            updateTasksDisplay(Array.isArray(tasks) ? tasks : []);
            
            // Update today's tasks section
            loadTodayTasks();
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            document.getElementById('tasks-list').innerHTML = '<p>Eroare la încărcarea taskurilor</p>';
        });
}

// Map OpenWeatherMap icon codes to emoji
const WEATHER_EMOJI = {
    '01d': '☀️',  '01n': '🌙',
    '02d': '🌤️', '02n': '🌤️',
    '03d': '⛅',  '03n': '⛅',
    '04d': '☁️',  '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️',  '11n': '⛈️',
    '13d': '❄️',  '13n': '❄️',
    '50d': '🌫️', '50n': '🌫️',
};

function weatherEmoji(icon) {
    return WEATHER_EMOJI[icon] || WEATHER_EMOJI[icon?.slice(0, 2) + 'd'] || '🌡️';
}

function loadWeather() {
    // Current weather
    fetch('/api/weather/current')
        .then(response => response.json())
        .then(data => {
            const weatherEl = document.getElementById('weather');
            if (!weatherEl) return;
            const emoji = weatherEmoji(data.icon);
            weatherEl.innerHTML = `
                <span class="weather-emoji">${emoji}</span>
                <span class="weather-temp">${Math.round(data.temperature)}°</span>
                <div class="weather-info">
                    <span class="weather-desc">${data.description}</span>
                    <span class="weather-city">${data.city}</span>
                </div>
            `;
        })
        .catch(error => {
            console.warn('Weather not available:', error);
        });

    // 5-day forecast strip
    fetch('/api/weather/forecast?days=5')
        .then(response => response.json())
        .then(data => {
            const forecastEl = document.getElementById('weather-forecast');
            if (!forecastEl || !data.daily) return;

            const dayNames = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
            const today = new Date().toDateString();

            const html = data.daily.slice(0, 5).map(day => {
                const date = new Date(day.date);
                const isToday = date.toDateString() === today;
                const label = isToday ? 'Azi' : dayNames[date.getDay()];
                const emoji = weatherEmoji(day.icon);
                const popText = day.pop_avg > 0.1
                    ? `<span class="forecast-pop">💧${Math.round(day.pop_avg * 100)}%</span>`
                    : '';

                return `
                    <div class="forecast-day${isToday ? ' today' : ''}">
                        <span class="forecast-day-name">${label}</span>
                        <span class="forecast-emoji">${emoji}</span>
                        <div class="forecast-temps">
                            <span class="forecast-temp-high">${Math.round(day.temp_max)}°</span>
                            <span class="forecast-temp-low">${Math.round(day.temp_min)}°</span>
                        </div>
                        ${popText}
                    </div>
                `;
            }).join('');

            forecastEl.innerHTML = html;
        })
        .catch(error => {
            console.warn('Forecast not available:', error);
        });
}

// ── Weather hourly popup ──────────────────────────────
let weatherPopupData = null;

function openWeatherPopup() {
    const popup = document.getElementById('weather-popup');
    if (!popup) return;

    if (weatherPopupData) {
        renderWeatherPopup(weatherPopupData);
        popup.hidden = false;
        return;
    }

    fetch('/api/weather/forecast?days=2')
        .then(r => r.json())
        .then(data => {
            if (!data.hourly) return;
            weatherPopupData = data;
            renderWeatherPopup(data);
            popup.hidden = false;
        })
        .catch(err => console.warn('Hourly weather error:', err));
}

function closeWeatherPopup() {
    const popup = document.getElementById('weather-popup');
    if (popup) popup.hidden = true;
}

function renderWeatherPopup(data) {
    const hours = data.hourly || [];
    const city = data.city || '';
    document.getElementById('weather-popup-title').textContent =
        `Prognoză orară — ${city}`;

    // ── Render hour items ──
    const hoursEl = document.getElementById('weather-popup-hours');
    const now = new Date();
    const currentHour = now.getHours();

    hoursEl.innerHTML = hours.map(h => {
        const dt = new Date(h.datetime);
        const hh = dt.getHours();
        const label = hh === 0 ? '00:00' : `${String(hh).padStart(2, '0')}:00`;
        const isNow = dt.getDate() === now.getDate() && hh === currentHour;
        const iconUrl = `https://openweathermap.org/img/wn/${h.icon}@2x.png`;
        const popHtml = h.pop > 0.05
            ? `<span class="wh-pop">💧${Math.round(h.pop * 100)}%</span>`
            : `<span class="wh-pop" style="visibility:hidden">–</span>`;

        return `<div class="weather-hour-item${isNow ? ' current-hour' : ''}">
            <span class="wh-time">${label}</span>
            <img class="wh-icon" src="${iconUrl}" alt="${h.description}" title="${h.description}">
            <span class="wh-temp">${Math.round(h.temperature)}°</span>
            ${popHtml}
        </div>`;
    }).join('');

    // ── Draw SVG chart ──
    drawWeatherChart(hours);
}

function drawWeatherChart(hours) {
    const svg = document.getElementById('weather-chart');
    if (!svg || hours.length < 2) return;

    const W = 392, H = 88;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const temps = hours.map(h => h.temperature);
    const tMin = Math.min(...temps) - 1;
    const tMax = Math.max(...temps) + 1;
    const n = hours.length;

    const px = i => Math.round((i / (n - 1)) * (W - 20) + 10);
    const py = t => Math.round(H - 22 - ((t - tMin) / (tMax - tMin)) * (H - 32));

    // Build smooth path using cardinal spline
    const pts = hours.map((h, i) => [px(i), py(h.temperature)]);

    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const x0 = pts[i][0], y0 = pts[i][1];
        const x1 = pts[i + 1][0], y1 = pts[i + 1][1];
        const cx = (x0 + x1) / 2;
        d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }

    // Gradient fill area
    const fillD = d + ` L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;

    svg.innerHTML = `
        <defs>
            <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <path d="${fillD}" fill="url(#wg)" stroke="none"/>
        <path d="${d}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
        ${pts.map(([x, y], i) => {
            const t = Math.round(hours[i].temperature);
            const showLabel = i % 2 === 0 || i === pts.length - 1;
            return `
                <circle cx="${x}" cy="${y}" r="3" fill="#3b82f6" stroke="white" stroke-width="1.5"/>
                ${showLabel ? `<text x="${x}" y="${y - 6}" text-anchor="middle"
                    font-size="9" font-family="var(--font)" fill="#334155" font-weight="600"
                    >${t}°</text>` : ''}
            `;
        }).join('')}
    `;
}

function setupWeatherPopup() {
    const weatherEl = document.getElementById('weather');
    const popup = document.getElementById('weather-popup');
    const closeBtn = document.getElementById('weather-popup-close');

    if (!weatherEl || !popup) return;

    weatherEl.addEventListener('click', e => {
        e.stopPropagation();
        if (popup.hidden) {
            openWeatherPopup();
        } else {
            closeWeatherPopup();
        }
    });

    closeBtn?.addEventListener('click', closeWeatherPopup);

    document.addEventListener('click', e => {
        if (!popup.hidden && !popup.contains(e.target) && e.target !== weatherEl) {
            closeWeatherPopup();
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeWeatherPopup();
    });
}

function loadTodayTasks() {
    fetch('/api/tasks/today')
        .then(response => response.json())
        .then(tasks => {
            updateTodayTasksDisplay(tasks);
        })
        .catch(error => {
            console.error('Error loading today\'s tasks:', error);
            document.getElementById('today-tasks-list').innerHTML = '<p>Eroare la încărcarea taskurilor de azi</p>';
        });
}

function updateTasksDisplay(tasks) {
    const tasksList = document.getElementById('tasks-list');
    if (!tasksList) return;
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p>Nu există taskuri pentru acest utilizator.</p>';
        return;
    }
    
    tasksList.innerHTML = tasks.map(task => createTaskElement(task)).join('');
    
    // Add event listeners to task elements
    tasks.forEach((task, index) => {
        const taskElement = tasksList.children[index];
        if (taskElement) {
            setupTaskEventListeners(taskElement, task);
        }
    });
}

function updateTodayTasksDisplay(tasks) {
    const todayTasksList = document.getElementById('today-tasks-list');
    if (!todayTasksList) return;
    if (tasks.length === 0) {
        todayTasksList.innerHTML = '<p>Nu există taskuri pentru astăzi.</p>';
        return;
    }
    
    todayTasksList.innerHTML = tasks.map(task => createTodayTaskElement(task)).join('');
    
    // Add event listeners to today's task elements
    tasks.forEach((task, index) => {
        const taskElement = todayTasksList.children[index];
        if (taskElement) {
            setupTodayTaskEventListeners(taskElement, task);
        }
    });
}

function createTaskElement(task) {
    const statusClass = task.status === 'completed' ? 'completed' : 
                       task.status === 'refused' ? 'refused' : '';
    const recurrenceBadge = task.recurrence_pattern !== 'none' ? 
        `<span class="badge recurrence-badge">${getRecurrenceLabel(task.recurrence_pattern)}</span>` : '';
    
    return `
        <div class="task-item ${statusClass}" data-task-id="${task.id}">
            <div class="task-content">
                <h3 class="task-title">${task.description}</h3>
                <div class="task-meta">
                    <span class="task-date">${formatDate(task.scheduled_date)}</span>
                    ${recurrenceBadge}
                </div>
                <div class="task-actions">
                    <button class="btn btn-sm btn-${task.status === 'completed' ? 'secondary' : 'primary'}" 
                            data-action="toggle-status">
                        ${task.status === 'completed' ? 'Anulează' : 'Finalizează'}
                    </button>
                    <button class="btn btn-sm btn-${task.status === 'refused' ? 'secondary' : 'warning'}" 
                            data-action="toggle-refuse">
                        ${task.status === 'refused' ? 'Anulează refuz' : 'Refuză'}
                    </button>
                    <button class="btn btn-sm btn-info" data-action="add-comment">
                        Comentarii
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit-task">
                        Editează
                    </button>
                    <button class="btn btn-sm btn-danger" data-action="delete-task">
                        Șterge
                    </button>
                </div>
            </div>
        </div>
    `;
}

function createTodayTaskElement(task) {
    const statusClass = task.status === 'completed' ? 'completed' : 
                       task.status === 'refused' ? 'refused' : '';
    const timeStr = new Date(task.scheduled_date).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    
    return `
        <div class="task-item today-task ${statusClass}" data-task-id="${task.id}">
            <div class="task-content">
                <div class="task-time">${timeStr}</div>
                <div class="task-details">
                    <h4>${task.description}</h4>
                    <p class="task-user">${task.user_name || 'Utilizator ID: ' + task.user_id}</p>
                    ${task.recurrence_pattern !== 'none' ? 
                        `<span class="badge badge-info">${getRecurrenceLabel(task.recurrence_pattern)}</span>` : ''}
                </div>
                <div class="task-actions today">
                    <button class="btn btn-sm btn-${task.status === 'completed' ? 'secondary' : 'primary'}" 
                            data-action="toggle-status">
                        ${task.status === 'completed' ? 'Anulează' : 'Finalizează'}
                    </button>
                    <button class="btn btn-sm btn-${task.status === 'refused' ? 'secondary' : 'warning'}" 
                            data-action="toggle-refuse">
                        ${task.status === 'refused' ? 'Anulează refuz' : 'Refuză'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getRecurrenceLabel(pattern) {
    const labels = {
        'daily': 'Zilnic',
        'weekly': 'Săptămânal',
        'monthly': 'Lunar',
        'yearly': 'Anual'
    };
    return labels[pattern] || pattern;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ro-RO', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function setupEventListeners() {
    // User selection
    document.getElementById('user-list').addEventListener('click', function(e) {
        const userItem = e.target.closest('.user-item');
        if (userItem) {
            // Remove active class from all users
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Add active class to clicked user
            userItem.classList.add('active');
            
            // Load tasks for selected user
            loadTasksForUser(userItem.dataset.userId);
        }
    });
    
    // Add user button
    document.getElementById('add-user-btn').addEventListener('click', function() {
        const name = prompt('Introduceți numele utilizatorului:');
        if (name && name.trim() !== '') {
            fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: name.trim() })
            })
            .then(response => {
                if (response.ok) {
                    loadUsers(); // Refresh user list
                } else {
                    return response.json().then(err => alert('Eroare: ' + (err.error || 'Unknown error')));
                }
            })
            .catch(error => {
                console.error('Error creating user:', error);
                alert('Eroare la crearea utilizatorului');
            });
        }
    });
    
    // Add task button
    document.getElementById('add-task-btn').addEventListener('click', function() {
        showAddTaskForm();
    });
    
}

function setupTaskEventListeners(taskElement, task) {
    // Toggle status (complete/pending)
    const statusBtn = taskElement.querySelector('[data-action="toggle-status"]');
    if (statusBtn) {
        statusBtn.addEventListener('click', function() {
            const newStatus = task.status === 'completed' ? 'pending' : 'completed';
            updateTask(task.id, { status: newStatus })
                .then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
        });
    }
    
    // Toggle refuse
    const refuseBtn = taskElement.querySelector('[data-action="toggle-refuse"]');
    if (refuseBtn) {
        refuseBtn.addEventListener('click', function() {
            const newStatus = task.status === 'refused' ? 'pending' : 'refused';
            updateTask(task.id, { status: newStatus })
                .then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
        });
    }
    
    // Add comment
    const commentBtn = taskElement.querySelector('[data-action="add-comment"]');
    if (commentBtn) {
        commentBtn.addEventListener('click', function() {
            showAddCommentForm(task.id);
        });
    }
    
    // Edit task
    const editBtn = taskElement.querySelector('[data-action="edit-task"]');
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            showEditTaskForm(task);
        });
    }
    
    // Delete task
    const deleteBtn = taskElement.querySelector('[data-action="delete-task"]');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (confirm('Sigur doriți să ștergeți acest task?')) {
                deleteTask(task.id)
                    .then(() => {
                        loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                        loadTodayTasks();
                    });
            }
        });
    }
}

function setupTodayTaskEventListeners(taskElement, task) {
    // Toggle status (complete/pending)
    const statusBtn = taskElement.querySelector('[data-action="toggle-status"]');
    if (statusBtn) {
        statusBtn.addEventListener('click', function() {
            const newStatus = task.status === 'completed' ? 'pending' : 'completed';
            updateTask(task.id, { status: newStatus })
                .then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
        });
    }
    
    // Toggle refuse
    const refuseBtn = taskElement.querySelector('[data-action="toggle-refuse"]');
    if (refuseBtn) {
        refuseBtn.addEventListener('click', function() {
            const newStatus = task.status === 'refused' ? 'pending' : 'refused';
            updateTask(task.id, { status: newStatus })
                .then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
        });
    }
}

function showAddTaskForm() {
    const userId = document.querySelector('.user-item.active')?.dataset.userId || 1;
    
    const html = `
        <div class="task-modal">
            <div class="modal-content">
                <h2>Adaugă task nou</h2>
                <form id="add-task-form">
                    <div class="form-group">
                        <label for="task-description">Descriere:</label>
                        <input type="text" id="task-description" required>
                    </div>
                    <div class="form-group">
                        <label for="task-date">Data și oră:</label>
                        <input type="datetime-local" id="task-date" required>
                    </div>
                    <div class="form-group">
                        <label for="task-recurrence">Recurență:</label>
                        <select id="task-recurrence">
                            <option value="none">Fără recurență</option>
                            <option value="daily">Zilnic</option>
                            <option value="weekly">Săptămânal</option>
                            <option value="monthly">Lunar</option>
                            <option value="yearly">Anual</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="task-recurrence-end">Data sfârșit recurență (opțional):</label>
                        <input type="date" id="task-recurrence-end">
                    </div>
                    <button type="submit" class="btn btn-primary">Adaugă task</button>
                    <button type="button" class="btn btn-secondary" id="cancel-add-task">Anulează</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Set default date to now
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    document.getElementById('task-date').value = localNow.toISOString().slice(0, 16);
    
    // Form submission
    document.getElementById('add-task-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const description = document.getElementById('task-description').value.trim();
        const date = document.getElementById('task-date').value;
        const recurrence = document.getElementById('task-recurrence').value;
        const recurrenceEnd = document.getElementById('task-recurrence-end').value;
        
        if (!description) {
            alert('Descrierea taskului este obligatorie');
            return;
        }
        
        const taskData = {
            description: description,
            user_id: parseInt(userId),
            scheduled_date: date
        };
        
        if (recurrence !== 'none') {
            taskData.recurrence_pattern = recurrence;
            if (recurrenceEnd) {
                taskData.recurrence_end_date = recurrenceEnd;
            }
        }
        
        fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        })
        .then(response => {
            if (response.ok) {
                closeModal();
                loadTasksForUser(userId);
                loadTodayTasks();
            } else {
                return response.json().then(err => alert('Eroare: ' + (err.error || 'Unknown error')));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Eroare la adăugarea taskului');
        });
    });
    
    // Cancel button
    document.getElementById('cancel-add-task').addEventListener('click', function() {
        closeModal();
    });
    
    // Close on overlay click
    document.querySelector('.task-modal').addEventListener('click', function(e) {
        if (e.target === this) { closeModal(); }
    });
}

function showEditTaskForm(task) {
    const html = `
        <div class="task-modal">
            <div class="modal-content">
                <h2>Editează task</h2>
                <form id="edit-task-form">
                    <div class="form-group">
                        <label for="edit-task-description">Descriere:</label>
                        <input type="text" id="edit-task-description" value="${task.description}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-task-date">Data și oră:</label>
                        <input type="datetime-local" id="edit-task-date" value="${new Date(task.scheduled_date).toISOString().slice(0, 16)}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-task-recurrence">Recurență:</label>
                        <select id="edit-task-recurrence">
                            <option value="none" ${task.recurrence_pattern === 'none' ? 'selected' : ''}>Fără recurență</option>
                            <option value="daily" ${task.recurrence_pattern === 'daily' ? 'selected' : ''}>Zilnic</option>
                            <option value="weekly" ${task.recurrence_pattern === 'weekly' ? 'selected' : ''}>Săptămânal</option>
                            <option value="monthly" ${task.recurrence_pattern === 'monthly' ? 'selected' : ''}>Lunar</option>
                            <option value="yearly" ${task.recurrence_pattern === 'yearly' ? 'selected' : ''}>Anual</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-task-recurrence-end">Data sfârșit recurență (opțional):</label>
                        <input type="date" id="edit-task-recurrence-end" value="${task.recurrence_end_date ? new Date(task.recurrence_end_date).toISOString().slice(0, 10) : ''}">
                    </div>
                    <button type="submit" class="btn btn-primary">Salvează modificări</button>
                    <button type="button" class="btn btn-secondary" id="cancel-edit-task">Anulează</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Form submission
    document.getElementById('edit-task-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const description = document.getElementById('edit-task-description').value.trim();
        const date = document.getElementById('edit-task-date').value;
        const recurrence = document.getElementById('edit-task-recurrence').value;
        const recurrenceEnd = document.getElementById('edit-task-recurrence-end').value;
        
        if (!description) {
            alert('Descrierea taskului este obligatorie');
            return;
        }
        
        const taskData = {
            description: description,
            scheduled_date: date
        };
        
        if (recurrence !== 'none') {
            taskData.recurrence_pattern = recurrence;
            if (recurrenceEnd) {
                taskData.recurrence_end_date = recurrenceEnd;
            } else {
                taskData.recurrence_end_date = null;
            }
        } else {
            taskData.recurrence_pattern = 'none';
            taskData.recurrence_end_date = null;
        }
        
        fetch(`/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        })
        .then(response => {
            if (response.ok) {
                closeModal();
                loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                loadTodayTasks();
            } else {
                return response.json().then(err => alert('Eroare: ' + (err.error || 'Unknown error')));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Eroare la actualizarea taskului');
        });
    });
    
    // Cancel button
    document.getElementById('cancel-edit-task').addEventListener('click', function() {
        closeModal();
    });
    
    // Close on overlay click
    document.querySelector('.task-modal').addEventListener('click', function(e) {
        if (e.target === this) { closeModal(); }
    });
}

function showAddCommentForm(taskId) {
    const html = `
        <div class="task-modal">
            <div class="modal-content">
                <h2>Adaugă comentariu</h2>
                <form id="add-comment-form">
                    <div class="form-group">
                        <label for="comment-text">Comentariu:</label>
                        <textarea id="comment-text" rows="4" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Adaugă comentariu</button>
                    <button type="button" class="btn btn-secondary" id="cancel-add-comment">Anulează</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Form submission
    document.getElementById('add-comment-form').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const text = document.getElementById('comment-text').value.trim();
        const userId = document.querySelector('.user-item.active')?.dataset.userId || 1;
        
        if (!text) {
            alert('Comentariul este obligatoriu');
            return;
        }
        
        fetch(`/api/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text, user_id: parseInt(userId) })
        })
        .then(response => {
            if (response.ok) {
                closeModal();
                // Reload tasks to see updated comments
                loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
            } else {
                return response.json().then(err => alert('Eroare: ' + (err.error || 'Unknown error')));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Eroare la adăugarea comentariului');
        });
    });
    
    // Cancel button
    document.getElementById('cancel-add-comment').addEventListener('click', function() {
        closeModal();
    });
    
    // Close on overlay click
    document.querySelector('.task-modal').addEventListener('click', function(e) {
        if (e.target === this) { closeModal(); }
    });
}

// Helper functions for API calls
function updateTask(taskId, data) {
    return fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    });
}

function deleteTask(taskId) {
    return fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
    }).then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Unknown error'); });
        }
        return response.json();
    });
}

function closeModal() {
    const modal = document.querySelector('.task-modal');
    if (modal) {
        modal.remove();
    }
}

// CSS for modals (added dynamically)
const modalStyle = document.createElement('style');
modalStyle.textContent = `
    .task-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .modal-content {
        background-color: white;
        padding: 2rem;
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
    }
    
    .modal-content h2 {
        margin-top: 0;
    }
    
    .form-group {
        margin-bottom: 1.5rem;
    }
    
    .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: bold;
    }
    
    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 1rem;
        box-sizing: border-box;
    }
    
    .form-group textarea {
        resize: vertical;
    }
    
    .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
        margin-right: 0.5rem;
        margin-bottom: 0.5rem;
        transition: background-color 0.3s;
    }
    
    .btn-primary {
        background-color: #3498db;
        color: white;
    }
    
    .btn-primary:hover {
        background-color: #2c80b9;
    }
    
    .btn-secondary {
        background-color: #95a5a6;
        color: white;
    }
    
    .btn-secondary:hover {
        background-color: #7f8c8d;
    }
    
    .btn-danger {
        background-color: #e74c3c;
        color: white;
    }
    
    .btn-danger:hover {
        background-color: #c0392b;
    }
    
    .badge {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        border-radius: 12px;
        font-size: 0.75rem;
        font-weight: bold;
        margin-left: 0.5rem;
    }
    
    .badge-info {
        background-color: #3498db;
        color: white;
    }
    
    .badge-recurrence {
        background-color: #9b59b6;
        color: white;
    }
    
    @media (max-width: 480px) {
        .modal-content {
            width: 95%;
            padding: 1.5rem;
        }
    }
`;
document.head.appendChild(modalStyle);


// Speak text using browser TTS
function speakText(text) {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voicePrefs.language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Prefer a voice matching the language
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === voicePrefs.language)
                || voices.find(v => v.lang.startsWith(voicePrefs.language.split('-')[0]));
    if (match) utterance.voice = match;

    window.speechSynthesis.speak(utterance);
}

// Process voice command by sending to AI chat
function processVoiceCommand(command) {
    showVoiceFeedback('Am auzit: "' + command + '"', false);

    // Open the chat panel and show the voice command as user message
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer && !chatContainer.classList.contains('open')) {
        chatContainer.classList.add('open');
    }

    addUserMessage('🎙️ ' + command);
    showTypingIndicator();

    fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: command })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Network error'); });
        }
        return response.json();
    })
    .then(data => {
        removeTypingIndicator();
        const reply = data.response || 'Nu am putut genera un răspuns.';
        addAIMessage(reply);
        scrollToBottom();
        speakText(reply);

        if (data.action === 'task_created') {
            loadTodayTasks();
            const activeUser = document.querySelector('.user-item.active');
            if (activeUser) loadTasksForUser(activeUser.dataset.userId);
        }
        if (data.action === 'weather_data') {
            loadWeather();
        }
    })
    .catch(error => {
        console.error('Error processing voice command:', error);
        removeTypingIndicator();
        addAIMessage('Eroare la procesarea comenzii vocale.');
        scrollToBottom();
        showVoiceFeedback('Eroare la comunicarea cu AI', true);
    });
}

// Show visual feedback for voice interaction
function showVoiceFeedback(message, isError = false) {
    // Remove any existing feedback
    const existingFeedback = document.querySelector('.voice-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'voice-feedback';
    feedback.textContent = message;
    feedback.style.position = 'fixed';
    feedback.style.top = '20px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.backgroundColor = isError ? '#e74c3c' : '#2ecc71';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '4px';
    feedback.style.zIndex = '1000';
    feedback.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    feedback.style.fontSize = '14px';
    
    document.body.appendChild(feedback);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.parentNode.removeChild(feedback);
        }
    }, 3000);
}

// AI Chat functionality
function initChat() {
    const chatContainer = document.getElementById('chat-container');
    const aiBtn = document.getElementById('ai-btn');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    
    // Toggle chat visibility
    aiBtn.addEventListener('click', function() {
        chatContainer.classList.toggle('open');
        if (chatContainer.classList.contains('open')) {
            chatInput.focus();
        }
    });
    
    // Close chat
    closeChatBtn.addEventListener('click', function() {
        chatContainer.classList.remove('open');
    });
    
    // Handle form submission
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addUserMessage(message);
        
        // Clear input
        chatInput.value = '';
        
        // Show typing indicator
        showTypingIndicator();
        
        // Send message to backend
        fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || 'Network response was not ok');
                });
            }
            return response.json();
        })
        .then(data => {
            // Remove typing indicator
            removeTypingIndicator();

            // Add AI response to chat
            if (data.response) {
                addAIMessage(data.response);
            } else {
                addAIMessage('Îmi pare rău, nu am putut genera un răspuns. Vă rugăm să încercați din nou.');
            }

            // If a task was created, refresh the task lists
            if (data.action === 'task_created') {
                loadTodayTasks();
                const activeUser = document.querySelector('.user-item.active');
                if (activeUser) {
                    loadTasksForUser(activeUser.dataset.userId);
                }
            }

            // Scroll to bottom
            scrollToBottom();
        })
        .catch(error => {
            console.error('Error in AI chat:', error);
            // Remove typing indicator
            removeTypingIndicator();
            
            // Add error message
            addAIMessage('A apărut o eroare la comunicarea cu serverul AI. Vă rugăm să încercați din nou.');
            
            // Scroll to bottom
            scrollToBottom();
        });
    });
    
    // Add sample messages on load
    setTimeout(() => {
        addAIMessage('Salut! Sunt HomeTasks AI assistant. Cum vă pot ajuta astăzi?');
    }, 500);
}

// Add user message to chat
function addUserMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `<p>${message}</p>`;
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageDiv);
    
    scrollToBottom();
}

// Add AI message to chat
function addAIMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    messageDiv.innerHTML = `<p>${message}</p>`;
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageDiv);
    
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    // Remove any existing typing indicator
    removeTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing-indicator';
    typingDiv.innerHTML = `<p>AI scrie...</p>`;
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(typingDiv);
    
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Settings functionality
function initSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const cancelSettingsBtn = document.getElementById('cancel-settings');
    const saveSettingsBtn = document.getElementById('save-settings');
    
    // Open settings modal
    settingsBtn.addEventListener('click', function() {
        settingsModal.classList.add('active');
        loadSettings(); // Load current settings when opening
    });
    
    // Close settings modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
    
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.getAttribute('data-tab');
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update active tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tab + '-tab') {
                    content.classList.add('active');
                }
            });
        });
    });
    
    // Cancel button
    cancelSettingsBtn.addEventListener('click', function() {
        settingsModal.classList.remove('active');
    });
    
    // Save button
    saveSettingsBtn.addEventListener('click', function() {
        saveSettings();
        settingsModal.classList.remove('active');
        showToast('Setările au fost salvate cu succes!');
    });
    
    // AI temperature slider
    const aiTempSlider = document.getElementById('ai-temperature');
    const aiTempValue = document.getElementById('ai-temp-value');
    if (aiTempSlider && aiTempValue) {
        aiTempSlider.addEventListener('input', function() {
            aiTempValue.textContent = this.value;
        });
    }
    
    // Voice sensitivity slider
    const voiceSensSlider = document.getElementById('voice-sensitivity');
    const voiceSensValue = document.getElementById('voice-sens-value');
    if (voiceSensSlider && voiceSensValue) {
        voiceSensSlider.addEventListener('input', function() {
            voiceSensValue.textContent = this.value;
        });
    }
}

// Load settings from backend and populate form
function loadSettings() {
    fetch('/api/preferences')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load settings');
            }
            return response.json();
        })
        .then(settings => {
            // Update voice preferences
            if (settings.voice_language) {
                voicePrefs.language = settings.voice_language;
            }
            if (settings.voice_sensitivity !== undefined) {
                voicePrefs.sensitivity = settings.voice_sensitivity;
            }
            
            // Populate general settings
            const appLanguageSelect = document.getElementById('app-language');
            if (appLanguageSelect && settings.language) {
                appLanguageSelect.value = settings.language;
            }
            
            const dateFormatSelect = document.getElementById('date-format');
            if (dateFormatSelect && settings.date_format) {
                dateFormatSelect.value = settings.date_format;
            }
            
            const timeFormatSelect = document.getElementById('time-format');
            if (timeFormatSelect && settings.time_format) {
                timeFormatSelect.value = settings.time_format;
            }
            
            // Populate weather settings
            const weatherCityInput = document.getElementById('weather-city');
            if (weatherCityInput && settings.weather_city) {
                weatherCityInput.value = settings.weather_city;
            }
            
            const weatherUnitsSelect = document.getElementById('weather-units');
            if (weatherUnitsSelect && settings.weather_units) {
                weatherUnitsSelect.value = settings.weather_units;
            }
            
            const weatherUpdateInput = document.getElementById('weather-update');
            if (weatherUpdateInput && settings.weather_update_interval) {
                weatherUpdateInput.value = settings.weather_update_interval;
            }
            
            // Populate AI settings
            const aiModelSelect = document.getElementById('ai-model');
            if (aiModelSelect && settings.ai_model) {
                aiModelSelect.value = settings.ai_model;
            }
            
            const aiTemperatureInput = document.getElementById('ai-temperature');
            const aiTempValue = document.getElementById('ai-temp-value');
            if (aiTemperatureInput && aiTempValue && settings.ai_temperature !== undefined) {
                aiTemperatureInput.value = settings.ai_temperature;
                aiTempValue.textContent = settings.ai_temperature;
            }
            
            const aiMaxTokensInput = document.getElementById('ai-max-tokens');
            if (aiMaxTokensInput && settings.ai_max_tokens) {
                aiMaxTokensInput.value = settings.ai_max_tokens;
            }
            
            // Populate voice settings
            const voiceLanguageSelect = document.getElementById('voice-language');
            if (voiceLanguageSelect && settings.voice_language) {
                voiceLanguageSelect.value = settings.voice_language;
            }
            
            const voiceSensitivityInput = document.getElementById('voice-sensitivity');
            const voiceSensValue = document.getElementById('voice-sens-value');
            if (voiceSensitivityInput && voiceSensValue && settings.voice_sensitivity !== undefined) {
                voiceSensitivityInput.value = settings.voice_sensitivity;
                voiceSensValue.textContent = settings.voice_sensitivity;
            }
            
            const voiceAutoStartCheckbox = document.getElementById('voice-auto-start');
            if (voiceAutoStartCheckbox && settings.voice_auto_start !== undefined) {
                voiceAutoStartCheckbox.checked = settings.voice_auto_start;
            }
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showToast('Eroare la încărcarea setărilor', true);
        });
}

// Save settings to backend
function saveSettings() {
    const settings = {
        // General
        language: document.getElementById('app-language')?.value,
        date_format: document.getElementById('date-format')?.value,
        time_format: document.getElementById('time-format')?.value,
        
        // Weather
        weather_city: document.getElementById('weather-city')?.value,
        weather_units: document.getElementById('weather-units')?.value,
        weather_update_interval: parseInt(document.getElementById('weather-update')?.value) || 30,
        
        // AI
        ai_model: document.getElementById('ai-model')?.value,
        ai_temperature: parseFloat(document.getElementById('ai-temperature')?.value) || 0.7,
        ai_max_tokens: parseInt(document.getElementById('ai-max-tokens')?.value) || 500,
        
        // Voice
        voice_language: document.getElementById('voice-language')?.value,
        voice_sensitivity: parseFloat(document.getElementById('voice-sensitivity')?.value) || 0.5,
        voice_auto_start: document.getElementById('voice-auto-start')?.checked || false
    };
    
    // Remove undefined values
    Object.keys(settings).forEach(key => {
        if (settings[key] === undefined) {
            delete settings[key];
        }
    });
    
    fetch('/api/preferences', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to save settings');
        }
        return response.json();
    })
    .then(data => {
        // Apply settings immediately
        applySettings(data);
        showToast('Setările au fost salvate și aplicate!');
    })
    .catch(error => {
        console.error('Error saving settings:', error);
        showToast('Eroare la salvarea setărilor', true);
    });
}

// Apply settings to the application
function applySettings(settings) {
    // Apply general settings
    if (settings.language) {
        document.documentElement.lang = settings.language;
        // Update date/time formatting would happen on next update
    }
    
    // Apply weather settings
    if (settings.weather_city || settings.weather_units) {
        weatherPopupData = null; // invalidate cached hourly data
        loadWeather();
    }
    
    // Apply AI settings
    if (settings.ai_model !== undefined || settings.ai_temperature !== undefined || settings.ai_max_tokens !== undefined) {
        // These will be used on next AI request
        // Could update a global config object here
    }
    
    // Apply voice settings
    if (settings.voice_language !== undefined || settings.voice_sensitivity !== undefined) {
        // These will be used on next voice recognition initialization
        // Could update a global config object here
    }
    
    // Apply auto-start voice setting
    if (settings.voice_auto_start !== undefined) {
        // Would start voice recognition if enabled
        // For now, we'll just note the preference
    }
}

// Show toast notification
function showToast(message, isError = false) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = isError ? '#e74c3c' : '#2ecc71';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '4px';
    toast.style.zIndex = '1000';
    toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    toast.style.fontSize = '14px';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    
    document.body.appendChild(toast);
    
    // Trigger reflow for animation
    void toast.offsetWidth;
    
    // Show toast
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
    
    // Hide after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        
        // Remove from DOM after transition
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadUsers();
    loadTodayTasks();
    loadWeather();
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Setup click/interaction event listeners
    setupEventListeners();

    // Initialize voice recognition
    initVoiceRecognition();

    // Initialize chat
    initChat();

    // Initialize settings
    initSettings();

    // Setup weather popup
    setupWeatherPopup();
});