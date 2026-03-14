// Main JavaScript for HomeTasks frontend - Faza 7: Interfața de gestionare a taskurilor
// Faza 8: Interfața vocală (client-side)

// ============================================================
// i18n — Translations
// ============================================================
const TRANSLATIONS = {
    ro: {
        // Voice
        voice_unavailable: 'Recunoașterea vocală nu este disponibilă în acest browser',
        mic_unavailable: 'Microfon: indisponibil',
        mic_available: 'Microfon: disponibil',
        listening: 'Ascult...',
        stop_listening: 'Oprire ascultare',
        start_listening: 'Pornește ascultarea',
        mic_available_status: 'Disponibil',
        mic_denied: 'Microfon: acces refuzat',
        voice_error: 'Eroare la recunoașterea vorbirii: ',
        voice_listening_prompt: 'Ascult... Vorbesc acum',
        voice_error_start: 'Eroare la pornirea recunoașterii vocale',
        voice_heard: 'Am auzit: "',
        // Users
        all_users: 'Toți',
        loading_users_error: 'Eroare la încărcarea utilizatorilor',
        no_users: 'Nu există utilizatori',
        deleted_user: 'Utilizator șters',
        prompt_user_name: 'Introduceți numele utilizatorului:',
        // Loading
        loading: 'Se încarcă...',
        loading_error: 'Eroare la încărcare.',
        loading_tasks_error: 'Eroare la încărcarea taskurilor',
        loading_today_error: 'Eroare la încărcarea taskurilor de azi',
        // Tasks
        no_tasks: 'Nu există taskuri.',
        no_tasks_today: 'Nu există taskuri pentru astăzi.',
        btn_undo_complete: 'Anulează finalizare',
        btn_complete: 'Finalizează',
        btn_undo_refuse: 'Anulează refuz',
        btn_refuse: 'Refuză',
        btn_comments: 'Comentarii',
        btn_edit: 'Editează',
        btn_delete: 'Șterge',
        recur_none: 'Fără recurență',
        recur_daily: 'Zilnic',
        recur_weekly: 'Săptămânal',
        recur_monthly: 'Lunar',
        recur_yearly: 'Anual',
        confirm_task_complete: 'Marchezi taskul ca finalizat?',
        confirm_task_undo_complete: 'Anulezi finalizarea taskului?',
        confirm_task_refuse: 'Refuzi acest task?',
        confirm_task_undo_refuse: 'Anulezi refuzul taskului?',
        confirm_task_delete: 'Sigur doriți să ștergeți acest task?',
        modal_add_task_title: 'Adaugă task nou',
        lbl_task_desc: 'Descriere:',
        lbl_task_date: 'Data și oră:',
        lbl_task_users: 'Utilizatori:',
        lbl_task_recurrence: 'Recurență:',
        lbl_task_recurrence_end: 'Sfârșit recurență (opțional):',
        btn_add_task: 'Adaugă task',
        validation_task_desc: 'Descrierea taskului este obligatorie',
        validation_task_users: 'Selectează cel puțin un utilizator',
        error_prefix: 'Eroare: ',
        error_create_user: 'Eroare la crearea utilizatorului',
        modal_edit_task_title: 'Editează task',
        btn_save_changes: 'Salvează modificări',
        btn_cancel: 'Anulează',
        // Comments
        modal_comments_title: 'Comentarii',
        comment_placeholder: 'Scrie un comentariu...',
        btn_send: 'Trimite',
        btn_close: 'Închide',
        no_comments: 'Nu există comentarii încă.',
        loading_comments_error: 'Eroare la încărcarea comentariilor.',
        error_comment: 'Eroare la adăugarea comentariului',
        // Confirm dialog
        btn_confirm: 'Confirmă',
        // Weather
        weather_hourly_prefix: 'Prognoză orară — ',
        day_names_short: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'],
        today_label: 'Azi',
        // AI Chat
        ai_no_response: 'Nu am putut genera un răspuns.',
        ai_voice_error: 'Eroare la procesarea comenzii vocale.',
        ai_connection_error: 'Eroare la comunicarea cu AI',
        ai_no_response_full: 'Îmi pare rău, nu am putut genera un răspuns. Vă rugăm să încercați din nou.',
        ai_server_error: 'A apărut o eroare la comunicarea cu serverul AI. Vă rugăm să încercați din nou.',
        tts_click_hint: 'Click pentru a asculta mesajul',
        ai_typing: 'AI scrie...',
        chat_welcome: 'Salut! Sunt HomeTasks asistentul tău AI. Cum vă pot să te ajut?',
        chat_initial_msg: 'Salut! Cum te pot ajuta?',
        // Settings
        settings_loading_error: 'Eroare la încărcarea setărilor',
        settings_users_error: 'Eroare la încărcarea utilizatorilor.',
        settings_no_users: 'Niciun utilizator creat.',
        user_name_placeholder: 'Nume utilizator',
        user_empty_name: 'Numele nu poate fi gol.',
        user_updated: 'Utilizator actualizat.',
        user_update_error: 'Eroare la actualizare.',
        user_delete_confirm: (name) => `Ștergi utilizatorul "${name}"?\nTaskurile sale vor rămâne în baza de date.`,
        user_deleted: 'Utilizator șters.',
        user_delete_error: 'Eroare la ștergere.',
        user_enter_name: 'Introduceți un nume.',
        user_added: 'Utilizator adăugat.',
        user_add_error: 'Eroare la adăugare.',
        ollama_unavailable: '— Ollama indisponibil —',
        settings_saved: 'Setările au fost salvate cu succes!',
        settings_saved_applied: 'Setările au fost salvate și aplicate!',
        settings_save_error: 'Eroare la salvarea setărilor',
        models_btn_label: '↻ Modele',
        // Static HTML (data-i18n keys)
        title_weather: 'Click pentru prognoză orară',
        title_reload: 'Reîncarcă pagina',
        title_settings: 'Setări',
        title_new_task: 'Task nou',
        title_check_models: 'Verifică modele disponibile',
        col_all_tasks: 'Toate taskurile',
        col_today: 'Astăzi',
        select_user_msg: 'Selectați un utilizator.',
        voice_btn_label: 'Comandă Vocală',
        voice_status_inactive: 'Inactiv',
        weather_popup_title: 'Prognoză vreme',
        chat_assistant_name: 'Asistent',
        chat_online_status: '● online',
        chat_placeholder: 'Scrieți un mesaj...',
        chat_send_title: 'Trimite',
        settings_title: 'Setări',
        tab_general: 'General',
        tab_users: 'Utilizatori',
        tab_weather: 'Vreme',
        tab_voice: 'Vocal',
        lbl_language: 'Limbă',
        opt_romanian: 'Română',
        opt_english: 'Engleză',
        lbl_date_format: 'Format dată',
        opt_date_short: 'Scurt (dd/mm/yyyy)',
        opt_date_long: 'Lung',
        opt_date_full: 'Complet',
        lbl_time_format: 'Format oră',
        lbl_weather_city: 'Oraș',
        lbl_weather_units: 'Unități',
        lbl_weather_update: 'Actualizare (minute)',
        lbl_ollama_url: 'URL Server Ollama',
        lbl_ai_model: 'Model AI',
        opt_select_model: '— selectați modelul —',
        lbl_ai_temp: 'Creativitate —',
        lbl_ai_tokens: 'Max tokeni',
        lbl_voice_lang: 'Limbă recunoaștere',
        opt_voice_ro: 'Română',
        opt_voice_en_us: 'Engleză (SUA)',
        opt_voice_en_gb: 'Engleză (UK)',
        lbl_tts_voice: 'Voce răspuns AI',
        opt_tts_auto: '— automat (limbă curentă) —',
        hint_tts_voices: 'Vocile disponibile depind de browser și sistemul de operare.',
        lbl_sensitivity: 'Sensibilitate —',
        lbl_auto_start: 'Autopornire',
        btn_save: 'Salvează',
        new_user_placeholder: 'Nume utilizator nou',
        color_user_title: 'Culoare utilizator',
        btn_add_user: '＋ Adaugă',
        // History
        history_title: 'Istoric Taskuri',
        history_btn_label: 'Istoric',
        history_filter_all_users: 'Toți utilizatorii',
        history_filter_all_status: 'Toate statusurile',
        history_filter_completed: 'Finalizate',
        history_filter_refused: 'Refuzate',
        history_filter_pending: 'În așteptare',
        history_period_7: 'Ultimele 7 zile',
        history_period_30: 'Ultima lună',
        history_period_90: 'Ultimele 3 luni',
        history_period_365: 'Ultimul an',
        history_period_all: 'Tot istoricul',
        no_history_tasks: 'Nu există taskuri în această perioadă.',
        history_status_completed: 'Finalizat',
        history_status_refused: 'Refuzat',
        history_status_pending: 'În așteptare',
    },
    en: {
        // Voice
        voice_unavailable: 'Speech recognition is not available in this browser',
        mic_unavailable: 'Microphone: unavailable',
        mic_available: 'Microphone: available',
        listening: 'Listening...',
        stop_listening: 'Stop listening',
        start_listening: 'Start listening',
        mic_available_status: 'Available',
        mic_denied: 'Microphone: access denied',
        voice_error: 'Speech recognition error: ',
        voice_listening_prompt: 'Listening... Speak now',
        voice_error_start: 'Error starting speech recognition',
        voice_heard: 'I heard: "',
        // Users
        all_users: 'All',
        loading_users_error: 'Error loading users',
        no_users: 'No users',
        deleted_user: 'Deleted user',
        prompt_user_name: 'Enter user name:',
        // Loading
        loading: 'Loading...',
        loading_error: 'Loading error.',
        loading_tasks_error: 'Error loading tasks',
        loading_today_error: "Error loading today's tasks",
        // Tasks
        no_tasks: 'No tasks.',
        no_tasks_today: 'No tasks for today.',
        btn_undo_complete: 'Undo complete',
        btn_complete: 'Complete',
        btn_undo_refuse: 'Undo refuse',
        btn_refuse: 'Refuse',
        btn_comments: 'Comments',
        btn_edit: 'Edit',
        btn_delete: 'Delete',
        recur_none: 'No recurrence',
        recur_daily: 'Daily',
        recur_weekly: 'Weekly',
        recur_monthly: 'Monthly',
        recur_yearly: 'Yearly',
        confirm_task_complete: 'Mark task as completed?',
        confirm_task_undo_complete: 'Undo task completion?',
        confirm_task_refuse: 'Refuse this task?',
        confirm_task_undo_refuse: 'Undo task refusal?',
        confirm_task_delete: 'Are you sure you want to delete this task?',
        modal_add_task_title: 'Add new task',
        lbl_task_desc: 'Description:',
        lbl_task_date: 'Date and time:',
        lbl_task_users: 'Users:',
        lbl_task_recurrence: 'Recurrence:',
        lbl_task_recurrence_end: 'Recurrence end (optional):',
        btn_add_task: 'Add task',
        validation_task_desc: 'Task description is required',
        validation_task_users: 'Select at least one user',
        error_prefix: 'Error: ',
        error_create_user: 'Error creating user',
        modal_edit_task_title: 'Edit task',
        btn_save_changes: 'Save changes',
        btn_cancel: 'Cancel',
        // Comments
        modal_comments_title: 'Comments',
        comment_placeholder: 'Write a comment...',
        btn_send: 'Send',
        btn_close: 'Close',
        no_comments: 'No comments yet.',
        loading_comments_error: 'Error loading comments.',
        error_comment: 'Error adding comment',
        // Confirm dialog
        btn_confirm: 'Confirm',
        // Weather
        weather_hourly_prefix: 'Hourly forecast — ',
        day_names_short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        today_label: 'Today',
        // AI Chat
        ai_no_response: 'Could not generate a response.',
        ai_voice_error: 'Error processing voice command.',
        ai_connection_error: 'Error communicating with AI',
        ai_no_response_full: "I'm sorry, I couldn't generate a response. Please try again.",
        ai_server_error: 'An error occurred communicating with the AI server. Please try again.',
        tts_click_hint: 'Click to listen to message',
        ai_typing: 'AI typing...',
        chat_welcome: "Hello! I'm HomeTasks AI assistant. How can I help you today?",
        chat_initial_msg: 'Hello! How can I help you?',
        // Settings
        settings_loading_error: 'Error loading settings',
        settings_users_error: 'Error loading users.',
        settings_no_users: 'No users created.',
        user_name_placeholder: 'User name',
        user_empty_name: 'Name cannot be empty.',
        user_updated: 'User updated.',
        user_update_error: 'Update error.',
        user_delete_confirm: (name) => `Delete user "${name}"?\nTheir tasks will remain in the database.`,
        user_deleted: 'User deleted.',
        user_delete_error: 'Delete error.',
        user_enter_name: 'Enter a name.',
        user_added: 'User added.',
        user_add_error: 'Add error.',
        ollama_unavailable: '— Ollama unavailable —',
        settings_saved: 'Settings saved successfully!',
        settings_saved_applied: 'Settings saved and applied!',
        settings_save_error: 'Error saving settings',
        models_btn_label: '↻ Models',
        // Static HTML (data-i18n keys)
        title_weather: 'Click for hourly forecast',
        title_reload: 'Reload page',
        title_settings: 'Settings',
        title_new_task: 'New task',
        title_check_models: 'Check available models',
        col_all_tasks: 'All tasks',
        col_today: 'Today',
        select_user_msg: 'Select a user.',
        voice_btn_label: 'Voice Command',
        voice_status_inactive: 'Inactive',
        weather_popup_title: 'Weather Forecast',
        chat_assistant_name: 'Assistant',
        chat_online_status: '● online',
        chat_placeholder: 'Type a message...',
        chat_send_title: 'Send',
        settings_title: 'Settings',
        tab_general: 'General',
        tab_users: 'Users',
        tab_weather: 'Weather',
        tab_voice: 'Voice',
        lbl_language: 'Language',
        opt_romanian: 'Romanian',
        opt_english: 'English',
        lbl_date_format: 'Date format',
        opt_date_short: 'Short (dd/mm/yyyy)',
        opt_date_long: 'Long',
        opt_date_full: 'Full',
        lbl_time_format: 'Time format',
        lbl_weather_city: 'City',
        lbl_weather_units: 'Units',
        lbl_weather_update: 'Update (minutes)',
        lbl_ollama_url: 'Ollama Server URL',
        lbl_ai_model: 'AI Model',
        opt_select_model: '— select model —',
        lbl_ai_temp: 'Creativity —',
        lbl_ai_tokens: 'Max tokens',
        lbl_voice_lang: 'Recognition language',
        opt_voice_ro: 'Romanian',
        opt_voice_en_us: 'English (US)',
        opt_voice_en_gb: 'English (UK)',
        lbl_tts_voice: 'AI response voice',
        opt_tts_auto: '— automatic (current language) —',
        hint_tts_voices: 'Available voices depend on browser and operating system.',
        lbl_sensitivity: 'Sensitivity —',
        lbl_auto_start: 'Auto-start',
        btn_save: 'Save',
        new_user_placeholder: 'New user name',
        color_user_title: 'User color',
        btn_add_user: '＋ Add',
        // History
        history_title: 'Task History',
        history_btn_label: 'History',
        history_filter_all_users: 'All users',
        history_filter_all_status: 'All statuses',
        history_filter_completed: 'Completed',
        history_filter_refused: 'Refused',
        history_filter_pending: 'Pending',
        history_period_7: 'Last 7 days',
        history_period_30: 'Last month',
        history_period_90: 'Last 3 months',
        history_period_365: 'Last year',
        history_period_all: 'All history',
        no_history_tasks: 'No tasks in this period.',
        history_status_completed: 'Completed',
        history_status_refused: 'Refused',
        history_status_pending: 'Pending',
    }
};

let currentLang = 'ro';

function t(key, ...args) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.ro;
    const val = dict[key] !== undefined ? dict[key] : (TRANSLATIONS.ro[key] !== undefined ? TRANSLATIONS.ro[key] : key);
    if (typeof val === 'function') return val(...args);
    return val;
}

function applyLanguage(lang) {
    currentLang = lang || 'ro';
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}

// Global voice preferences object
const voicePrefs = {
    language: 'ro-RO',  // Default language
    sensitivity: 0.5,   // Default sensitivity
    ttsVoiceName: localStorage.getItem('ttsVoiceName') || ''  // TTS voice (persisted locally)
};

// Initialize voice recognition
function initVoiceRecognition() {
    // Check if SpeechRecognition is available
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    const voiceStatus = document.getElementById('voice-status');

    if (!window.SpeechRecognition) {
        console.warn('SpeechRecognition not supported in this browser');
        document.getElementById('voice-btn').title = t('voice_unavailable');
        document.getElementById('voice-btn').style.opacity = '0.5';
        document.getElementById('voice-btn').style.cursor = 'not-allowed';
        voiceStatus.textContent = t('mic_unavailable');
        return;
    }

    voiceStatus.textContent = t('mic_available');

    let isListening = false;
    let currentRecognition = null;
    
    // Update button state
    function updateVoiceButton(listening) {
        const voiceBtn = document.getElementById('voice-btn');
        const label = document.getElementById('voice-btn-label');
        if (listening) {
            if (label) label.textContent = t('listening');
            voiceBtn.style.removeProperty('background-color');
            voiceBtn.classList.add('listening');
            voiceBtn.title = t('stop_listening');
            voiceStatus.textContent = t('listening');
        } else {
            if (label) label.textContent = t('voice_btn_label');
            voiceBtn.style.removeProperty('background-color');
            voiceBtn.classList.remove('listening');
            voiceBtn.title = t('start_listening');
            voiceStatus.textContent = t('mic_available_status');
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
                        voiceStatus.textContent = t('mic_denied');
                    }
                    // Show error feedback
                    showVoiceFeedback(t('voice_error') + event.error, true);
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
                
                showVoiceFeedback(t('voice_listening_prompt'), false);
            } catch (err) {
                console.error('Error starting speech recognition:', err);
                showVoiceFeedback(t('voice_error_start'), true);
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
            showVoiceFeedback(t('stop_listening'), false);
        }
    });
}

function updateDateTime() {
    const now = new Date();
    const locale = currentLang === 'en' ? 'en-US' : 'ro-RO';
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = now.toLocaleDateString(locale, options);
    const timeString = now.toLocaleTimeString(locale);
    document.getElementById('date-time').textContent = `${dateString}, ${timeString}`;
}

function loadUsers() {
    Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/tasks').then(r => r.json())
    ]).then(([users, tasks]) => {
        const counts = {};
        tasks.forEach(t => { counts[t.user_id] = (counts[t.user_id] || 0) + 1; });

        const userList = document.getElementById('user-list');
        userList.innerHTML = '';

        // "Toți utilizatorii" button — always first
        const allItem = document.createElement('div');
        allItem.className = 'user-item active';
        allItem.dataset.userId = 'all';
        allItem.innerHTML = `<span>${t('all_users')}</span>`;
        userList.appendChild(allItem);

        users.forEach(user => {
            const count = counts[user.id] || 0;
            const countBadge = count > 0 ? `<span class="user-task-count">${count}</span>` : '';
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.dataset.userId = user.id;
            userElement.innerHTML = `
                <div class="user-color" style="background-color: ${user.color}"></div>
                <span>${user.name}</span>
                ${countBadge}
            `;
            userList.appendChild(userElement);
        });

        // Display already-fetched tasks
        updateTasksDisplay(tasks);
    }).catch(error => {
        console.error('Error loading users:', error);
        document.getElementById('user-list').innerHTML = `<p>${t('loading_users_error')}</p>`;
    });
}

function refreshUserTaskCounts() {
    fetch('/api/tasks')
        .then(r => r.json())
        .then(tasks => {
            const counts = {};
            tasks.forEach(t => { counts[t.user_id] = (counts[t.user_id] || 0) + 1; });
            document.querySelectorAll('.user-item[data-user-id]').forEach(item => {
                if (item.dataset.userId === 'all') return;
                const count = counts[Number(item.dataset.userId)] || 0;
                let badge = item.querySelector('.user-task-count');
                if (count > 0) {
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'user-task-count';
                        item.appendChild(badge);
                    }
                    badge.textContent = count;
                } else if (badge) {
                    badge.remove();
                }
            });
        })
        .catch(() => {});
}

function loadAllTasks() {
    document.getElementById('tasks-list').innerHTML = `<p class="empty">${t('loading')}</p>`;
    fetch('/api/tasks')
        .then(r => r.json())
        .then(tasks => {
            updateTasksDisplay(tasks);
            refreshUserTaskCounts();
        })
        .catch(() => {
            document.getElementById('tasks-list').innerHTML = `<p class="empty">${t('loading_error')}</p>`;
        });
}

function loadTasksForUser(userId) {
    if (!userId || userId === 'all') return loadAllTasks();
    // Clear immediately so old tasks don't linger while loading
    document.getElementById('tasks-list').innerHTML = `<p class="empty">${t('loading')}</p>`;

    fetch(`/api/tasks?user_id=${userId}`)
        .then(response => response.json())
        .then(tasks => {
            updateTasksDisplay(Array.isArray(tasks) ? tasks : []);
            loadTodayTasks();
            refreshUserTaskCounts();
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            document.getElementById('tasks-list').innerHTML = `<p>${t('loading_tasks_error')}</p>`;
        });
}

// Map OpenWeatherMap icon codes to Unicode symbols (basic Misc Symbols, renders everywhere)
const WEATHER_EMOJI = {
    '01d': '☀',  '01n': '☽',
    '02d': '⛅',  '02n': '⛅',
    '03d': '⛅',  '03n': '⛅',
    '04d': '☁',  '04n': '☁',
    '09d': '☂',  '09n': '☂',
    '10d': '⛅',  '10n': '☂',
    '11d': '⚡',  '11n': '⚡',
    '13d': '❄',  '13n': '❄',
    '50d': '☁',  '50n': '☁',
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

    // 5-day forecast (în popup)
    fetch('/api/weather/forecast?days=5')
        .then(response => response.json())
        .then(data => {
            const forecastEl = document.getElementById('weather-popup-forecast');
            if (!forecastEl || !data.daily) return;

            const dayNames = t('day_names_short');
            const today = new Date().toDateString();

            const html = data.daily.slice(0, 5).map(day => {
                const date = new Date(day.date);
                const isToday = date.toDateString() === today;
                const label = isToday ? t('today_label') : dayNames[date.getDay()];
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
        t('weather_hourly_prefix') + city;

    // ── Render hour items ──
    const hoursEl = document.getElementById('weather-popup-hours');
    const now = new Date();
    const currentHour = now.getHours();

    const n = hours.length;
    // Same formula as drawWeatherChart: viewBox W=1000, margins 12
    const pct = i => ((i / (n - 1)) * (1000 - 24) + 12) / 1000 * 100;

    hoursEl.innerHTML = hours.map((h, i) => {
        const dt = new Date(h.datetime);
        const hh = dt.getHours();
        const label = hh === 0 ? '00:00' : `${String(hh).padStart(2, '0')}:00`;
        const isNow = dt.getDate() === now.getDate() && hh === currentHour;
        const emoji = weatherEmoji(h.icon);
        const popHtml = h.pop > 0.05
            ? `<span class="wh-pop">💧${Math.round(h.pop * 100)}%</span>`
            : `<span class="wh-pop" style="visibility:hidden">–</span>`;

        const pos = i === 0       ? 'left:0;transform:none'
                  : i === n - 1  ? 'right:0;left:auto;transform:none'
                  :                `left:${pct(i).toFixed(2)}%`;

        return `<div class="weather-hour-item${isNow ? ' current-hour' : ''}" style="${pos}">
            <span class="wh-time">${label}</span>
            <span class="wh-emoji" title="${h.description}">${emoji}</span>
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

    const W = 1000, H = 120;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const temps = hours.map(h => h.temperature);
    const tMin = Math.min(...temps) - 1;
    const tMax = Math.max(...temps) + 1;
    const n = hours.length;

    const px = i => Math.round((i / (n - 1)) * (W - 24) + 12);
    const py = t => Math.round(H - 28 - ((t - tMin) / (tMax - tMin)) * (H - 46));

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
                ${showLabel ? `<text x="${x}" y="${y - 7}" text-anchor="middle"
                    font-size="11" font-family="var(--font)" fill="#334155" font-weight="600"
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
            document.getElementById('today-tasks-list').innerHTML = `<p>${t('loading_today_error')}</p>`;
        });
}

function updateTasksDisplay(tasks) {
    const tasksList = document.getElementById('tasks-list');
    if (!tasksList) return;

    const badge = document.getElementById('all-tasks-count');
    if (badge) { badge.textContent = tasks.length; badge.hidden = tasks.length === 0; }

    if (tasks.length === 0) {
        tasksList.innerHTML = `<p class="empty">${t('no_tasks')}</p>`;
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

    const badge = document.getElementById('today-tasks-count');
    if (badge) { badge.textContent = tasks.length; badge.hidden = tasks.length === 0; }

    if (tasks.length === 0) {
        todayTasksList.innerHTML = `<p class="empty">${t('no_tasks_today')}</p>`;
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

// SVG icons for task action buttons
const TASK_ICONS = {
    check:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    undo:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>`,
    x:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    comment: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    edit:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    trash:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 0-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

function taskActionButtons(task, includeEditDelete = false) {
    const isCompleted = task.status === 'completed';
    const isRefused   = task.status === 'refused';

    const statusBtn = isCompleted
        ? `<button class="task-btn task-btn-undo" data-action="toggle-status" data-i18n-title="btn_undo_complete" title="${t('btn_undo_complete')}">${TASK_ICONS.undo}</button>`
        : `<button class="task-btn task-btn-complete" data-action="toggle-status" data-i18n-title="btn_complete" title="${t('btn_complete')}">${TASK_ICONS.check}</button>`;

    const refuseBtn = isRefused
        ? `<button class="task-btn task-btn-undo" data-action="toggle-refuse" data-i18n-title="btn_undo_refuse" title="${t('btn_undo_refuse')}">${TASK_ICONS.undo}</button>`
        : `<button class="task-btn task-btn-refuse" data-action="toggle-refuse" data-i18n-title="btn_refuse" title="${t('btn_refuse')}">${TASK_ICONS.x}</button>`;

    const commentBadge = task.comment_count > 0 ? `<span class="comment-badge">${task.comment_count}</span>` : '';
    const commentBtn = `<button class="task-btn task-btn-comment" data-action="add-comment" data-i18n-title="btn_comments" title="${t('btn_comments')}">${TASK_ICONS.comment}${commentBadge}</button>`;

    const extraBtns = includeEditDelete ? `
        <button class="task-btn task-btn-edit"   data-action="edit-task"   data-i18n-title="btn_edit"   title="${t('btn_edit')}">${TASK_ICONS.edit}</button>
        <button class="task-btn task-btn-delete" data-action="delete-task" data-i18n-title="btn_delete" title="${t('btn_delete')}">${TASK_ICONS.trash}</button>
    ` : '';

    return `<div class="task-actions">${statusBtn}${refuseBtn}${commentBtn}${extraBtns}</div>`;
}

function createTaskElement(task) {
    const statusClass = task.status === 'completed' ? 'completed' :
                        task.status === 'refused'   ? 'refused'   : '';
    const recurrenceBadge = task.recurrence_pattern !== 'none'
        ? `<span class="badge recurrence-badge">${getRecurrenceLabel(task.recurrence_pattern)}</span>` : '';

    return `
        <div class="task-item ${statusClass}" data-task-id="${task.id}">
            <div class="task-content">
                <h3 class="task-title">${task.description}</h3>
                <div class="task-meta">
                    <span class="task-date">${formatDate(task.scheduled_date)}</span>
                    ${recurrenceBadge}
                </div>
                ${taskActionButtons(task, true)}
            </div>
        </div>
    `;
}

function createTodayTaskElement(task) {
    const statusClass = task.status === 'completed' ? 'completed' :
                        task.status === 'refused'   ? 'refused'   : '';
    const locale = currentLang === 'en' ? 'en-US' : 'ro-RO';
    const timeStr = new Date(task.scheduled_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    return `
        <div class="task-item today-task ${statusClass}" data-task-id="${task.id}">
            <div class="task-content">
                <div class="task-time">${timeStr}</div>
                <div class="task-details">
                    <h4>${task.description}</h4>
                    <p class="task-user">${task.user_name || 'User ID: ' + task.user_id}</p>
                    ${task.recurrence_pattern !== 'none'
                        ? `<span class="badge badge-info">${getRecurrenceLabel(task.recurrence_pattern)}</span>` : ''}
                </div>
                ${taskActionButtons(task, false)}
            </div>
        </div>
    `;
}

function getRecurrenceLabel(pattern) {
    const keys = {
        'daily': 'recur_daily',
        'weekly': 'recur_weekly',
        'monthly': 'recur_monthly',
        'yearly': 'recur_yearly'
    };
    return keys[pattern] ? t(keys[pattern]) : pattern;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const locale = currentLang === 'en' ? 'en-US' : 'ro-RO';
    return date.toLocaleDateString(locale, {
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
    
    // Add user button (may not exist if UI uses settings modal instead)
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) addUserBtn.addEventListener('click', function() {
        const name = prompt(t('prompt_user_name'));
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
                    return response.json().then(err => showToast(t('error_prefix') + (err.error || 'Unknown error'), true));
                }
            })
            .catch(error => {
                console.error('Error creating user:', error);
                showToast(t('error_create_user'), true);
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
            const msg = newStatus === 'completed' ? t('confirm_task_complete') : t('confirm_task_undo_complete');
            const label = newStatus === 'completed' ? t('btn_complete') : t('btn_cancel');
            const cls = newStatus === 'completed' ? 'btn-primary' : 'btn-secondary';
            showConfirmDialog(msg, () => {
                updateTask(task.id, { status: newStatus }).then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
            }, label, cls);
        });
    }

    // Toggle refuse
    const refuseBtn = taskElement.querySelector('[data-action="toggle-refuse"]');
    if (refuseBtn) {
        refuseBtn.addEventListener('click', function() {
            const newStatus = task.status === 'refused' ? 'pending' : 'refused';
            const msg = newStatus === 'refused' ? t('confirm_task_refuse') : t('confirm_task_undo_refuse');
            const label = newStatus === 'refused' ? t('btn_refuse') : t('btn_undo_refuse');
            const cls = newStatus === 'refused' ? 'btn-warning' : 'btn-secondary';
            showConfirmDialog(msg, () => {
                updateTask(task.id, { status: newStatus }).then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
            }, label, cls);
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
            showConfirmDialog(t('confirm_task_delete'), function() {
                deleteTask(task.id)
                    .then(() => {
                        loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                        loadTodayTasks();
                    });
            });
        });
    }
}

function setupTodayTaskEventListeners(taskElement, task) {
    // Toggle status (complete/pending)
    const statusBtn = taskElement.querySelector('[data-action="toggle-status"]');
    if (statusBtn) {
        statusBtn.addEventListener('click', function() {
            const newStatus = task.status === 'completed' ? 'pending' : 'completed';
            const msg = newStatus === 'completed' ? t('confirm_task_complete') : t('confirm_task_undo_complete');
            const label = newStatus === 'completed' ? t('btn_complete') : t('btn_cancel');
            const cls = newStatus === 'completed' ? 'btn-primary' : 'btn-secondary';
            showConfirmDialog(msg, () => {
                updateTask(task.id, { status: newStatus }).then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
            }, label, cls);
        });
    }

    // Toggle refuse
    const refuseBtn = taskElement.querySelector('[data-action="toggle-refuse"]');
    if (refuseBtn) {
        refuseBtn.addEventListener('click', function() {
            const newStatus = task.status === 'refused' ? 'pending' : 'refused';
            const msg = newStatus === 'refused' ? t('confirm_task_refuse') : t('confirm_task_undo_refuse');
            const label = newStatus === 'refused' ? t('btn_refuse') : t('btn_undo_refuse');
            const cls = newStatus === 'refused' ? 'btn-warning' : 'btn-secondary';
            showConfirmDialog(msg, () => {
                updateTask(task.id, { status: newStatus }).then(() => {
                    loadTasksForUser(document.querySelector('.user-item.active').dataset.userId);
                    loadTodayTasks();
                });
            }, label, cls);
        });
    }

    // Comment button
    const commentBtn = taskElement.querySelector('[data-action="add-comment"]');
    if (commentBtn) {
        commentBtn.addEventListener('click', function() {
            showAddCommentForm(task.id);
        });
    }
}

function showAddTaskForm() {
    const activeUserId = document.querySelector('.user-item.active')?.dataset.userId || 1;

    const html = `
        <div class="task-modal">
            <div class="modal-content">
                <h2>${t('modal_add_task_title')}</h2>
                <form id="add-task-form">
                    <div class="form-group">
                        <label for="task-description">${t('lbl_task_desc')}</label>
                        <input type="text" id="task-description" required>
                    </div>
                    <div class="form-group">
                        <label for="task-date">${t('lbl_task_date')}</label>
                        <input type="datetime-local" id="task-date" required>
                    </div>
                    <div class="form-group">
                        <label>${t('lbl_task_users')}</label>
                        <div id="task-users-list" class="users-checkbox-list">
                            <em>${t('loading')}</em>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="task-recurrence">${t('lbl_task_recurrence')}</label>
                            <select id="task-recurrence">
                                <option value="none">${t('recur_none')}</option>
                                <option value="daily">${t('recur_daily')}</option>
                                <option value="weekly">${t('recur_weekly')}</option>
                                <option value="monthly">${t('recur_monthly')}</option>
                                <option value="yearly">${t('recur_yearly')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="task-recurrence-end">${t('lbl_task_recurrence_end')}</label>
                            <input type="date" id="task-recurrence-end">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">${t('btn_add_task')}</button>
                    <button type="button" class="btn btn-secondary" id="cancel-add-task">${t('btn_cancel')}</button>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Set default date to now
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    document.getElementById('task-date').value = localNow.toISOString().slice(0, 16);

    // Load users into checkbox list
    fetch('/api/users')
        .then(r => r.json())
        .then(users => {
            const container = document.getElementById('task-users-list');
            if (!users.length) {
                container.innerHTML = `<em>${t('no_users')}</em>`;
                return;
            }
            container.innerHTML = users.map(u => `
                <label class="user-checkbox-item" style="--user-color:${u.color}">
                    <input type="checkbox" name="task-user" value="${u.id}"
                        ${String(u.id) === String(activeUserId) ? 'checked' : ''}>
                    <span class="user-checkbox-dot"></span>
                    ${u.name}
                </label>
            `).join('');
        });

    // Form submission
    document.getElementById('add-task-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const description = document.getElementById('task-description').value.trim();
        const date = document.getElementById('task-date').value;
        const recurrence = document.getElementById('task-recurrence').value;
        const recurrenceEnd = document.getElementById('task-recurrence-end').value;
        const selectedUsers = Array.from(document.querySelectorAll('input[name="task-user"]:checked'))
            .map(cb => parseInt(cb.value));

        if (!description) {
            showToast(t('validation_task_desc'), true);
            return;
        }
        if (selectedUsers.length === 0) {
            showToast(t('validation_task_users'), true);
            return;
        }

        const baseTaskData = { description, scheduled_date: date };
        if (recurrence !== 'none') {
            baseTaskData.recurrence_pattern = recurrence;
            if (recurrenceEnd) baseTaskData.recurrence_end_date = recurrenceEnd;
        }

        const requests = selectedUsers.map(uid =>
            fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...baseTaskData, user_id: uid })
            }).then(r => r.ok ? r.json() : r.json().then(err => Promise.reject(err)))
        );

        Promise.all(requests)
            .then(() => {
                closeModal();
                loadTasksForUser(activeUserId);
                loadTodayTasks();
            })
            .catch(err => showToast(t('error_prefix') + (err.error || 'Unknown error'), true));
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
                <h2>${t('modal_edit_task_title')}</h2>
                <form id="edit-task-form">
                    <div class="form-group">
                        <label for="edit-task-description">${t('lbl_task_desc')}</label>
                        <input type="text" id="edit-task-description" value="${task.description}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-task-date">${t('lbl_task_date')}</label>
                        <input type="datetime-local" id="edit-task-date" value="${new Date(task.scheduled_date).toISOString().slice(0, 16)}" required>
                    </div>
                    <div class="form-group">
                        <label>${t('lbl_task_users')}</label>
                        <div id="edit-task-users-list" class="users-checkbox-list">
                            <em>${t('loading')}</em>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-task-recurrence">${t('lbl_task_recurrence')}</label>
                            <select id="edit-task-recurrence">
                                <option value="none" ${task.recurrence_pattern === 'none' ? 'selected' : ''}>${t('recur_none')}</option>
                                <option value="daily" ${task.recurrence_pattern === 'daily' ? 'selected' : ''}>${t('recur_daily')}</option>
                                <option value="weekly" ${task.recurrence_pattern === 'weekly' ? 'selected' : ''}>${t('recur_weekly')}</option>
                                <option value="monthly" ${task.recurrence_pattern === 'monthly' ? 'selected' : ''}>${t('recur_monthly')}</option>
                                <option value="yearly" ${task.recurrence_pattern === 'yearly' ? 'selected' : ''}>${t('recur_yearly')}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-task-recurrence-end">${t('lbl_task_recurrence_end')}</label>
                            <input type="date" id="edit-task-recurrence-end" value="${task.recurrence_end_date ? new Date(task.recurrence_end_date).toISOString().slice(0, 10) : ''}">
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary">${t('btn_save_changes')}</button>
                    <button type="button" class="btn btn-secondary" id="cancel-edit-task">${t('btn_cancel')}</button>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    // Load users into checkbox list, pre-check current task owner
    fetch('/api/users').then(r => r.json()).then(users => {
        const container = document.getElementById('edit-task-users-list');
        if (!users.length) {
            container.innerHTML = `<em>${t('no_users')}</em>`;
            return;
        }
        container.innerHTML = users.map(u => `
            <label class="user-checkbox-item" style="--user-color:${u.color}">
                <input type="checkbox" name="edit-task-user" value="${u.id}"
                    ${String(u.id) === String(task.user_id) ? 'checked' : ''}>
                <span class="user-checkbox-dot"></span>
                ${u.name}
            </label>
        `).join('');
    });

    // Form submission
    document.getElementById('edit-task-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const description = document.getElementById('edit-task-description').value.trim();
        const date = document.getElementById('edit-task-date').value;
        const recurrence = document.getElementById('edit-task-recurrence').value;
        const recurrenceEnd = document.getElementById('edit-task-recurrence-end').value;
        const selectedUsers = Array.from(document.querySelectorAll('input[name="edit-task-user"]:checked'))
            .map(cb => parseInt(cb.value));

        if (!description) {
            showToast(t('validation_task_desc'), true);
            return;
        }
        if (selectedUsers.length === 0) {
            showToast(t('validation_task_users'), true);
            return;
        }

        const baseTaskData = { description, scheduled_date: date };
        if (recurrence !== 'none') {
            baseTaskData.recurrence_pattern = recurrence;
            baseTaskData.recurrence_end_date = recurrenceEnd || null;
        } else {
            baseTaskData.recurrence_pattern = 'none';
            baseTaskData.recurrence_end_date = null;
        }

        const activeUserId = document.querySelector('.user-item.active').dataset.userId;

        // Update existing task for first selected user
        const updateRequest = fetch(`/api/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...baseTaskData, user_id: selectedUsers[0] })
        }).then(r => r.ok ? r.json() : r.json().then(err => Promise.reject(err)));

        // Create new tasks for any additional selected users
        const createRequests = selectedUsers.slice(1).map(uid =>
            fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...baseTaskData, user_id: uid })
            }).then(r => r.ok ? r.json() : r.json().then(err => Promise.reject(err)))
        );

        Promise.all([updateRequest, ...createRequests])
            .then(() => {
                closeModal();
                loadTasksForUser(activeUserId);
                loadTodayTasks();
            })
            .catch(err => showToast(t('error_prefix') + (err.error || 'Unknown error'), true));
    });

    // Cancel button
    document.getElementById('cancel-edit-task').addEventListener('click', closeModal);

    // Close on overlay click
    document.querySelector('.task-modal').addEventListener('click', function(e) {
        if (e.target === this) { closeModal(); }
    });
}

function showAddCommentForm(taskId) {
    const html = `
        <div class="task-modal">
            <div class="modal-content comments-modal-content">
                <h2>${t('modal_comments_title')}</h2>
                <div id="comments-list" class="comments-list">
                    <em class="comments-loading">${t('loading')}</em>
                </div>
                <form id="add-comment-form" class="add-comment-form">
                    <select id="comment-user" class="comment-user-select">
                        <option value="">${t('loading')}</option>
                    </select>
                    <textarea id="comment-text" rows="2" placeholder="${t('comment_placeholder')}" required></textarea>
                    <div class="add-comment-actions">
                        <button type="submit" class="btn btn-primary btn-sm">${t('btn_send')}</button>
                        <button type="button" class="btn btn-secondary btn-sm" id="cancel-add-comment">${t('btn_close')}</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    const activeUserId = document.querySelector('.user-item.active')?.dataset.userId;
    let usersCache = [];

    // Load users into select and cache them for comment display
    fetch('/api/users').then(r => r.json()).then(users => {
        usersCache = users;
        const select = document.getElementById('comment-user');
        if (!select) return;
        select.innerHTML = users.map(u =>
            `<option value="${u.id}" data-color="${u.color}" ${String(u.id) === String(activeUserId) ? 'selected' : ''}>${u.name}</option>`
        ).join('');
    });

    function loadComments() {
        fetch(`/api/tasks/${taskId}/comments`).then(r => r.json()).then(comments => {
            const container = document.getElementById('comments-list');
            if (!container) return;

            if (!comments.length) {
                container.innerHTML = `<p class="comments-empty">${t('no_comments')}</p>`;
                return;
            }

            const userMap = {};
            usersCache.forEach(u => { userMap[u.id] = u; });

            container.innerHTML = comments.map(c => {
                const user = userMap[c.user_id];
                const userName = user ? user.name : t('deleted_user');
                const userColor = user ? user.color : '#aaa';
                const date = new Date(c.created_at).toLocaleString(currentLang === 'en' ? 'en-US' : 'ro-RO', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                return `
                    <div class="comment-item">
                        <div class="comment-header">
                            <span class="comment-author-dot" style="background:${userColor}"></span>
                            <span class="comment-author">${userName}</span>
                            <span class="comment-date">${date}</span>
                        </div>
                        <p class="comment-text">${c.text}</p>
                    </div>
                `;
            }).join('');
        }).catch(() => {
            const container = document.getElementById('comments-list');
            if (container) container.innerHTML = `<p class="comments-empty">${t('loading_comments_error')}</p>`;
        });
    }

    loadComments();

    // Form submission
    document.getElementById('add-comment-form').addEventListener('submit', function(e) {
        e.preventDefault();

        const text = document.getElementById('comment-text').value.trim();
        const userId = document.getElementById('comment-user').value;

        if (!text) return;

        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        fetch(`/api/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, user_id: parseInt(userId) })
        })
        .then(response => {
            if (response.ok) {
                document.getElementById('comment-text').value = '';
                loadComments();
            } else {
                return response.json().then(err => showToast(t('error_prefix') + (err.error || 'Unknown error'), true));
            }
        })
        .catch(() => showToast(t('error_comment'), true))
        .finally(() => { submitBtn.disabled = false; });
    });

    document.getElementById('cancel-add-comment').addEventListener('click', closeModal);

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

function showConfirmDialog(message, onConfirm, confirmLabel = null, confirmClass = 'btn-danger') {
    if (!confirmLabel) confirmLabel = t('btn_confirm');
    const html = `
        <div class="task-modal" id="confirm-dialog">
            <div class="modal-content" style="max-width:360px;text-align:center;">
                <p style="margin:0 0 1.5rem;font-size:1rem;">${message}</p>
                <button type="button" class="btn ${confirmClass}" id="confirm-yes">${confirmLabel}</button>
                <button type="button" class="btn btn-secondary" id="confirm-no">${t('btn_cancel')}</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    const dialog = document.getElementById('confirm-dialog');
    dialog.querySelector('#confirm-yes').addEventListener('click', function() {
        dialog.remove();
        onConfirm();
    });
    dialog.querySelector('#confirm-no').addEventListener('click', function() {
        dialog.remove();
    });
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) dialog.remove();
    });
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


// Populate TTS voice selector with all available voices
function populateTTSVoices() {
    const select = document.getElementById('tts-voice');
    if (!select || !window.speechSynthesis) return;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;

    // Keep the default "auto" option, then rebuild the rest
    select.innerHTML = '<option value="">— automat (limbă curentă) —</option>';

    voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})${v.localService ? '' : ' ☁'}`;
        if (v.name === voicePrefs.ttsVoiceName) opt.selected = true;
        select.appendChild(opt);
    });
}

// Speak text using browser TTS
function speakText(text) {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voicePrefs.language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (voicePrefs.ttsVoiceName) {
        const saved = voices.find(v => v.name === voicePrefs.ttsVoiceName);
        if (saved) utterance.voice = saved;
    } else {
        // Auto: prefer a voice matching the recognition language
        const match = voices.find(v => v.lang === voicePrefs.language)
                    || voices.find(v => v.lang.startsWith(voicePrefs.language.split('-')[0]));
        if (match) utterance.voice = match;
    }

    window.speechSynthesis.speak(utterance);
    return utterance;
}

// Process voice command by sending to AI chat
function processVoiceCommand(command) {
    showVoiceFeedback(t('voice_heard') + command + '"', false);

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
        const reply = data.response || t('ai_no_response');
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
        addAIMessage(t('ai_voice_error'));
        scrollToBottom();
        showVoiceFeedback(t('ai_connection_error'), true);
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
                addAIMessage(t('ai_no_response_full'));
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
            addAIMessage(t('ai_server_error'));
            
            // Scroll to bottom
            scrollToBottom();
        });
    });
    
    // Restore chat history or show welcome message
    const existing = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    if (existing.length > 0) {
        restoreChatHistory();
    } else {
        setTimeout(() => {
            addAIMessage(t('chat_welcome'));
        }, 500);
    }
}

// ── Chat persistence ──────────────────────────────────
const CHAT_STORAGE_KEY = 'hometasks_chat_history';

function saveChatMessage(role, message) {
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    history.push({ role, message });
    // Keep last 100 messages
    if (history.length > 100) history.splice(0, history.length - 100);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history));
}

function restoreChatHistory() {
    const history = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
    history.forEach(({ role, message }) => {
        if (role === 'user') addUserMessage(message, false);
        else addAIMessage(message, false);
    });
}

// Add user message to chat
function addUserMessage(message, save = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message';
    messageDiv.innerHTML = `<p>${message}</p>`;

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageDiv);

    if (save) saveChatMessage('user', message);
    scrollToBottom();
}

// Add AI message to chat
function addAIMessage(message, save = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    messageDiv.title = t('tts_click_hint');
    messageDiv.innerHTML = `<p>${message}<span class="tts-icon">🔊</span></p>`;

    messageDiv.addEventListener('click', function () {
        // Stop if clicking the same speaking message
        if (this.classList.contains('speaking')) {
            window.speechSynthesis?.cancel();
            this.classList.remove('speaking');
            return;
        }
        // Stop any other speaking message
        document.querySelectorAll('.ai-message.speaking').forEach(el => el.classList.remove('speaking'));

        this.classList.add('speaking');
        const el = this;
        const utterance = speakText(message);
        if (utterance) {
            utterance.onend = () => el.classList.remove('speaking');
            utterance.onerror = () => el.classList.remove('speaking');
        }
    });

    const chatMessages = document.getElementById('chat-messages');
    chatMessages.appendChild(messageDiv);

    if (save) saveChatMessage('ai', message);
    scrollToBottom();
}

// Show typing indicator
function showTypingIndicator() {
    // Remove any existing typing indicator
    removeTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai-message typing-indicator';
    typingDiv.innerHTML = `<p>${t('ai_typing')}</p>`;
    
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

// ============================================================
// Utility
// ============================================================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// Settings – User Management Tab
// ============================================================
function loadSettingsUsersTab() {
    const container = document.getElementById('settings-users-list');
    if (!container) return;
    container.innerHTML = `<p class="settings-empty">${t('loading')}</p>`;
    fetch('/api/users')
        .then(r => r.json())
        .then(users => renderSettingsUsersList(users))
        .catch(() => {
            container.innerHTML = `<p class="settings-empty">${t('settings_users_error')}</p>`;
        });
}

function renderSettingsUsersList(users) {
    const container = document.getElementById('settings-users-list');
    if (!container) return;
    if (!users.length) {
        container.innerHTML = `<p class="settings-empty">${t('settings_no_users')}</p>`;
        return;
    }
    container.innerHTML = users.map(u => `
        <div class="settings-user-row" id="settings-user-${u.id}">
            <span class="user-color-dot" style="background:${escapeHtml(u.color)}"></span>
            <span class="settings-user-name">${escapeHtml(u.name)}</span>
            <div class="settings-user-actions">
                <button class="btn btn-sm btn-secondary" onclick="editUserInSettings(${u.id},'${escapeHtml(u.name)}','${escapeHtml(u.color)}')" title="${t('btn_edit')}">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUserFromSettings(${u.id},'${escapeHtml(u.name)}')" title="${t('btn_delete')}">🗑️</button>
            </div>
        </div>
    `).join('');
}

function editUserInSettings(userId, name, color) {
    const row = document.getElementById(`settings-user-${userId}`);
    if (!row) return;
    row.innerHTML = `
        <input type="color" value="${escapeHtml(color)}" id="edit-color-${userId}" title="Culoare">
        <input type="text" value="${escapeHtml(name)}" id="edit-name-${userId}" style="flex:1" placeholder="${t('user_name_placeholder')}">
        <div class="settings-user-actions">
            <button class="btn btn-sm btn-primary" onclick="saveUserEditFromSettings(${userId})" title="${t('btn_save')}">✓</button>
            <button class="btn btn-sm btn-secondary" onclick="loadSettingsUsersTab()" title="${t('btn_cancel')}">✗</button>
        </div>
    `;
    document.getElementById(`edit-name-${userId}`)?.focus();
    document.getElementById(`edit-name-${userId}`)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveUserEditFromSettings(userId);
        if (e.key === 'Escape') loadSettingsUsersTab();
    });
}

function saveUserEditFromSettings(userId) {
    const name = document.getElementById(`edit-name-${userId}`)?.value?.trim();
    const color = document.getElementById(`edit-color-${userId}`)?.value;
    if (!name) { showToast(t('user_empty_name'), true); return; }
    fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
    })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(() => {
        loadSettingsUsersTab();
        loadUsers();
        showToast(t('user_updated'));
    })
    .catch(() => showToast(t('user_update_error'), true));
}

function deleteUserFromSettings(userId, name) {
    showConfirmDialog(t('user_delete_confirm', name), () => {
        fetch(`/api/users/${userId}`, { method: 'DELETE' })
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(() => {
                loadSettingsUsersTab();
                loadUsers();
                showToast(t('user_deleted'));
            })
            .catch(() => showToast(t('user_delete_error'), true));
    });
}

function addUserFromSettings() {
    const nameInput = document.getElementById('settings-new-user-name');
    const colorInput = document.getElementById('settings-new-user-color');
    const name = nameInput?.value?.trim();
    const color = colorInput?.value || '#3498db';
    if (!name) { showToast(t('user_enter_name'), true); nameInput?.focus(); return; }
    fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
    })
    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
    .then(() => {
        if (nameInput) nameInput.value = '';
        if (colorInput) colorInput.value = '#3498db';
        loadSettingsUsersTab();
        loadUsers();
        showToast(t('user_added'));
    })
    .catch(() => showToast(t('user_add_error'), true));
}

// ============================================================
// AI – Dynamic Model Loading
// ============================================================
function loadAvailableModels(currentModel) {
    const select = document.getElementById('ai-model');
    if (!select) return;
    fetch('/api/ai/models')
        .then(r => r.json())
        .then(data => {
            if (data.error || !data.models?.length) {
                if (!currentModel) {
                    select.innerHTML = `<option value="">${t('ollama_unavailable')}</option>`;
                } else {
                    select.innerHTML = `<option value="${escapeHtml(currentModel)}">${escapeHtml(currentModel)}</option>`;
                }
                return;
            }
            const chosen = currentModel || select.value;
            select.innerHTML = data.models
                .map(m => `<option value="${escapeHtml(m.name)}"${m.name === chosen ? ' selected' : ''}>${escapeHtml(m.name)}</option>`)
                .join('');
        })
        .catch(() => {
            if (currentModel) {
                select.innerHTML = `<option value="${escapeHtml(currentModel)}">${escapeHtml(currentModel)}</option>`;
            } else {
                select.innerHTML = `<option value="">${t('ollama_unavailable')}</option>`;
            }
        });
}

// ============================================================
// Startup Preferences – apply voice prefs before recognition init
// ============================================================
function loadStartupPreferences() {
    fetch('/api/preferences')
        .then(r => r.json())
        .then(prefs => {
            if (prefs.voice_language) voicePrefs.language = prefs.voice_language;
            if (prefs.voice_sensitivity !== undefined) voicePrefs.sensitivity = prefs.voice_sensitivity;
            if (prefs.language && prefs.language !== currentLang) {
                applyLanguage(prefs.language);
                // Reload tasks with new language
                const activeUser = document.querySelector('.user-item.active');
                if (activeUser) loadTasksForUser(activeUser.dataset.userId);
                loadTodayTasks();
                loadUsers(); // also updates "Toți/All" button
            }
        })
        .catch(() => {});
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

    // Populate TTS voice list when the Vocal tab is opened
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === 'voice') {
            btn.addEventListener('click', populateTTSVoices);
        }
    });

    // Load users when Utilizatori tab is opened
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === 'utilizatori') {
            btn.addEventListener('click', loadSettingsUsersTab);
        }
    });

    // Load AI models when AI tab is opened
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === 'ai') {
            btn.addEventListener('click', () => loadAvailableModels());
        }
    });

    // Add user from settings button
    const addUserSettingsBtn = document.getElementById('settings-add-user-btn');
    if (addUserSettingsBtn) {
        addUserSettingsBtn.addEventListener('click', addUserFromSettings);
    }
    const newUserNameInput = document.getElementById('settings-new-user-name');
    if (newUserNameInput) {
        newUserNameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') addUserFromSettings();
        });
    }

    // Load models button (AI tab)
    const loadModelsBtn = document.getElementById('load-models-btn');
    if (loadModelsBtn) {
        loadModelsBtn.addEventListener('click', function () {
            this.textContent = '↻ ...';
            loadAvailableModels();
            setTimeout(() => { this.textContent = t('models_btn_label'); }, 2000);
        });
    }

    // Save TTS voice selection immediately on change
    const ttsVoiceSelect = document.getElementById('tts-voice');
    if (ttsVoiceSelect) {
        ttsVoiceSelect.addEventListener('change', function() {
            voicePrefs.ttsVoiceName = this.value;
            localStorage.setItem('ttsVoiceName', this.value);
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
            const ollamaUrlInput = document.getElementById('ollama-url');
            if (ollamaUrlInput && settings.ollama_base_url) {
                ollamaUrlInput.value = settings.ollama_base_url;
            }

            // Load available models dynamically, pre-select saved model
            loadAvailableModels(settings.ai_model);
            
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
            showToast(t('settings_loading_error'), true);
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
        ollama_base_url: document.getElementById('ollama-url')?.value?.trim() || 'http://localhost:11434',
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
        showToast(t('settings_saved_applied'));
    })
    .catch(error => {
        console.error('Error saving settings:', error);
        showToast(t('settings_save_error'), true);
    });
}

// Apply settings to the application
function applySettings(settings) {
    // Apply general settings
    if (settings.language) {
        applyLanguage(settings.language);
        // Reload tasks so dynamically generated buttons get retranslated
        const activeUser = document.querySelector('.user-item.active');
        if (activeUser) loadTasksForUser(activeUser.dataset.userId);
        loadTodayTasks();
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

// ============================================================
// History Panel
// ============================================================

let historyUsersCache = [];

function openHistoryPanel() {
    const modal = document.getElementById('history-modal');
    if (!modal) return;
    modal.classList.add('active');
    populateHistoryUserFilter();
    loadHistoryTasks();
}

function closeHistoryPanel() {
    const modal = document.getElementById('history-modal');
    if (modal) modal.classList.remove('active');
}

function populateHistoryUserFilter() {
    fetch('/api/users')
        .then(r => r.json())
        .then(users => {
            historyUsersCache = users;
            const sel = document.getElementById('history-user-filter');
            if (!sel) return;
            const currentVal = sel.value;
            sel.innerHTML = `<option value="">${t('history_filter_all_users')}</option>` +
                users.map(u => `<option value="${u.id}"${currentVal == u.id ? ' selected' : ''}>${u.name}</option>`).join('');
        })
        .catch(() => {});
}

function toLocalISOString(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function loadHistoryTasks() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;
    listEl.innerHTML = `<p class="empty">${t('loading')}</p>`;

    const userId  = document.getElementById('history-user-filter')?.value || '';
    const status  = document.getElementById('history-status-filter')?.value || '';
    const days    = parseInt(document.getElementById('history-period-filter')?.value ?? '30', 10);

    let url = `/api/tasks?`;
    if (userId) url += `user_id=${userId}&`;
    if (status) url += `status=${status}&`;
    if (days > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        url += `start_date=${encodeURIComponent(toLocalISOString(startDate))}`;
    }

    fetch(url)
        .then(r => r.json())
        .then(tasks => renderHistoryTasks(Array.isArray(tasks) ? tasks : []))
        .catch(() => {
            listEl.innerHTML = `<p class="empty">${t('loading_error')}</p>`;
        });
}

function renderHistoryTasks(tasks) {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;

    if (tasks.length === 0) {
        listEl.innerHTML = `<p class="empty">${t('no_history_tasks')}</p>`;
        return;
    }

    // Build user lookup
    const userMap = {};
    historyUsersCache.forEach(u => { userMap[u.id] = u; });

    // Group by month
    const groups = {};
    const locale = currentLang === 'en' ? 'en-US' : 'ro-RO';
    tasks.forEach(task => {
        const d = task.scheduled_date ? new Date(task.scheduled_date) : null;
        const key = d
            ? d.toLocaleDateString(locale, { year: 'numeric', month: 'long' })
            : (currentLang === 'en' ? 'No date' : 'Fără dată');
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
    });

    const statusLabels = {
        completed: t('history_status_completed'),
        refused:   t('history_status_refused'),
        pending:   t('history_status_pending'),
    };

    let html = '';
    for (const [month, monthTasks] of Object.entries(groups)) {
        html += `<div class="history-group-header">${month} <span style="font-weight:400;opacity:.7">(${monthTasks.length})</span></div>`;
        monthTasks.forEach(task => {
            const status = task.status || 'pending';
            const user = userMap[task.user_id];
            const dateStr = task.scheduled_date
                ? new Date(task.scheduled_date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
                : '—';
            const userDot = user
                ? `<span class="history-user-dot" style="background:${user.color}"></span>${user.name}`
                : '';
            const recurrenceHtml = task.recurrence_pattern && task.recurrence_pattern !== 'none'
                ? `<span class="badge recurrence-badge">${getRecurrenceLabel(task.recurrence_pattern)}</span>`
                : '';
            const commentHtml = task.comment_count > 0
                ? `<span title="${t('btn_comments')}">💬 ${task.comment_count}</span>`
                : '';

            html += `
                <div class="history-task ${status}" data-task-id="${task.id}">
                    <div class="history-status-dot ${status}"></div>
                    <div class="history-task-body">
                        <div class="history-task-desc">${task.description}</div>
                        <div class="history-task-meta">
                            <span>${dateStr}</span>
                            ${userDot ? `<span>${userDot}</span>` : ''}
                            <span>${statusLabels[status] || status}</span>
                            ${recurrenceHtml}
                            ${commentHtml}
                        </div>
                    </div>
                </div>`;
        });
    }
    listEl.innerHTML = html;
}

function initHistoryPanel() {
    document.getElementById('history-btn')?.addEventListener('click', openHistoryPanel);
    document.getElementById('close-history-btn')?.addEventListener('click', closeHistoryPanel);
    document.getElementById('history-modal')?.addEventListener('click', function(e) {
        if (e.target === this) closeHistoryPanel();
    });
    ['history-user-filter', 'history-status-filter', 'history-period-filter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', loadHistoryTasks);
    });
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load initial data
    loadUsers();
    loadTodayTasks();
    loadWeather();
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Load and apply preferences at startup (voice language, sensitivity etc.)
    loadStartupPreferences();

    // Setup click/interaction event listeners
    setupEventListeners();

    // Initialize voice recognition
    initVoiceRecognition();

    // Load TTS voices (may be async in some browsers)
    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = populateTTSVoices;
        populateTTSVoices(); // also try immediately (Chrome desktop loads sync)
    }

    // Initialize chat
    initChat();

    // Initialize settings
    initSettings();

    // Setup weather popup
    setupWeatherPopup();

    // Initialize history panel
    initHistoryPanel();
});