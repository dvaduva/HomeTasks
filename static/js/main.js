// Main JavaScript for HomeTasks frontend - Faza 7: Interfața de gestionare a taskurilor
// Faza 8: Interfața vocală (client-side)

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initApp();
    
    // Initialize voice recognition
    initVoiceRecognition();
});

function initApp() {
    // Update date and time
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Load initial data
    loadUsers();
    loadWeather();
    loadTodayTasks();
    
    // Set up event listeners
    setupEventListeners();
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
    fetch(`/api/tasks?user_id=${userId}`)
        .then(response => response.json())
        .then(tasks => {
            // Update tasks display
            updateTasksDisplay(tasks);
            
            // Update today's tasks section
            loadTodayTasks();
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            document.getElementById('tasks-list').innerHTML = '<p>Eroare la încărcarea taskurilor</p>';
        });
}

function loadWeather() {
    fetch('/api/weather/current')
        .then(response => response.json())
        .then(data => {
            const weatherEl = document.getElementById('weather');
            if (weatherEl) {
                weatherEl.innerHTML = `
                    <span class="weather-temp">${Math.round(data.temperature)}°C</span>
                    <span class="weather-desc">${data.description}</span>
                    <span class="weather-city">${data.city}</span>
                `;
            }
        })
        .catch(error => {
            console.warn('Weather not available:', error);
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
                    <p class="task-user">Utilizator ID: ${task.user_id}</p>
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
    
    // Settings button
    document.getElementById('settings-btn').addEventListener('click', function() {
        alert('Setările vor fi implementate în versiunea ulterioară');
    });
    
    // Voice button
    document.getElementById('voice-btn').addEventListener('click', function() {
        alert('Funcționalitatea vocală va fi implementată în versiunea ulterioară');
    });
    
    // AI button
    document.getElementById('ai-btn').addEventListener('click', function() {
        alert('Funcționalitatea AI va fi implementată în versiunea ulterioară');
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
        <div class="modal-overlay">
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
    document.querySelector('.modal-overlay').addEventListener('click', function(e) {
        if (e.target === document.querySelector('.modal-overlay')) {
            closeModal();
        }
    });
}

function showEditTaskForm(task) {
    const html = `
        <div class="modal-overlay">
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
    document.querySelector('.modal-overlay').addEventListener('click', function(e) {
        if (e.target === document.querySelector('.modal-overlay')) {
            closeModal();
        }
    });
}

function showAddCommentForm(taskId) {
    const html = `
        <div class="modal-overlay">
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
    document.querySelector('.modal-overlay').addEventListener('click', function(e) {
        if (e.target === document.querySelector('.modal-overlay')) {
            closeModal();
        }
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
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// CSS for modals (added dynamically)
const modalStyle = document.createElement('style');
modalStyle.textContent = `
    .modal-overlay {
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

// Voice recognition functionality
function initVoiceRecognition() {
    // Check if SpeechRecognition is available
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!('SpeechRecognition' in window)) {
        console.warn('SpeechRecognition not supported in this browser');
        document.getElementById('voice-btn').title = 'Recunoașterea vocală nu este disponibilă în acest browser';
        document.getElementById('voice-btn').style.opacity = '0.5';
        document.getElementById('voice-btn').style.cursor = 'not-allowed';
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ro-RO'; // Romanian language
    
    let isListening = false;
    
    // Update button state
    function updateVoiceButton(listening) {
        const voiceBtn = document.getElementById('voice-btn');
        if (listening) {
            voiceBtn.innerHTML = '🎤 Ascult...';
            voiceBtn.style.backgroundColor = '#e74c3c';
            voiceBtn.title = 'Oprire ascultare';
        } else {
            voiceBtn.innerHTML = '🎤 Comandă Vocală';
            voiceBtn.style.backgroundColor = '#3498db';
            voiceBtn.title = 'Pornește ascultarea';
        }
    }
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript.trim();
        console.log('Voice command received:', transcript);
        
        // Process the voice command
        processVoiceCommand(transcript);
        
        // Stop listening after getting a result
        recognition.stop();
        isListening = false;
        updateVoiceButton(isListening);
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        updateVoiceButton(isListening);
        
        // Show error feedback
        showVoiceFeedback('Eroare la recunoașterea vorbirii: ' + event.error, true);
    };
    
    recognition.onend = function() {
        isListening = false;
        updateVoiceButton(isListening);
    };
    
    // Voice button click handler
    document.getElementById('voice-btn').addEventListener('click', function() {
        if (!isListening) {
            // Start listening
            try {
                recognition.start();
                isListening = true;
                updateVoiceButton(isListening);
                showVoiceFeedback('Ascult... Vorbesc acum', false);
            } catch (err) {
                console.error('Error starting speech recognition:', err);
                showVoiceFeedback('Eroare la pornirea recunoașterii vocale', true);
            }
        } else {
            // Stop listening
            recognition.stop();
            isListening = false;
            updateVoiceButton(isListening);
            showVoiceFeedback('Oprire ascultare', false);
        }
    });
}

// Process voice command by sending to backend
function processVoiceCommand(command) {
    showVoiceFeedback('Procesare comandă: "' + command + '"', false);
    
    fetch('/api/voice-command', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: command })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Voice command response:', data);
        showVoiceFeedback(data.response, false);
        
        // If the command was to add a task, refresh the task list
        if (command.toLowerCase().includes('adaugă task') || command.toLowerCase().includes('add task')) {
            // Reload tasks for current user
            const activeUser = document.querySelector('.user-item.active');
            if (activeUser) {
                loadTasksForUser(activeUser.dataset.userId);
                loadTodayTasks();
            }
        }
        
        // If the command was about weather, refresh weather
        if (command.toLowerCase().includes('vreme') || command.toLowerCase().includes('weather')) {
            loadWeather();
        }
    })
    .catch(error => {
        console.error('Error processing voice command:', error);
        showVoiceFeedback('Eroare la procesarea comenzii vocale', true);
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