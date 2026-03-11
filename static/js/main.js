// Main JavaScript for HomeTasks frontend - Faza 7: Interfața de gestionare a taskurilor

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initApp();
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
            
            # Update today's tasks section
            loadTodayTasks();
        })
        .catch(error => {
            console.error('Error loading tasks:', error);
            document.getElementById('tasks-list').innerHTML = '<p>Eroare la încărcarea taskurilor</p>';
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
    if (tasks.length === 0) {
        tasksList.innerHTML = '<p>Nu există taskuri pentru acest utilizator.</p>';
        return;
    }
    
    tasksList.innerHTML = tasks.map(task => createTaskElement(task)).join('');
    
    # Add event listeners to task elements
    tasks.forEach((task, index) => {
        const taskElement = tasksList.children[index];
        if (taskElement) {
            setupTaskEventListeners(taskElement, task);
        }
    });
}

function updateTodayTasksDisplay(tasks) {
    const todayTasksList = document.getElementById('today-tasks-list');
    if (tasks.length === 0) {
        todayTasksList.innerHTML = '<p>Nu există taskuri pentru astăzi.</p>';
        return;
    }
    
    todayTasksList.innerHTML = tasks.map(task => createTodayTaskElement(task)).join('');
    
    # Add event listeners to today's task elements
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
                        ${task.status === 'refused' ? 'Anulează refuz' : 'Refuzează'}
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
                        ${task.status === 'refused' ? 'Anulează refuz' : 'Refuzează'}
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
        
        const description = document.getElementBy