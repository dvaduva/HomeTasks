# Implementation phases - HomeTasks

> **English** · [Română](IMPLEMENTATION_PHASES.ro.md)

This page describes the recommended phases for implementing the HomeTasks application, organized in a logical order to ensure an efficient and testable development flow.

## Phase 1: Preparing the environment and the basic structure

**Goal**: Creating the directory structure and configuring the development environment

### Activities:
- Creating the project directory structure according to the specifications in README.md
- Setting up the Python virtual environment (`venv`)
- Creating the `.env.example` file with the required variables
- Creating the `requirements.txt` file with the basic dependencies
- Initializing the Git repository (optional)
- Verifying that the environment works with a simple "Hello World" script

**Deliverables**:
- The project directory with the correct structure
- An activated and functional virtual environment
- Basic configuration files (`.env.example`, `requirements.txt`)

## Phase 2: The database and the data models

**Goal**: Implementing persistent storage for tasks, users and comments

### Activities:
- Designing the SQLite database schema
- Creating the SQLAlchemy models for:
  - User (name, color, preferences, etc.)
  - Task (description, date, assigned user, status, recurrence, etc.)
  - Comment (text, timestamp, link to the task)
  - Application preferences (language, temperature units, etc.)
- Implementing the basic CRUD (Create, Read, Update, Delete) functions for each model
- Creating database migrations (optional, for schema evolution)
- Writing simple unit tests for the models

**Deliverables**:
- The model files in `src/task_manager/`
- Functional data access functions
- The SQLite database initialized with the correct tables

## Phase 3: The backend API - Tasks and users

**Goal**: Creating the REST endpoints for managing tasks and users

### Activities:
- Implementing the endpoints in `src/main.py` (or separate controllers if the project grows):
  - GET `/api/tasks` - List of tasks with filtering (day, user, etc.)
  - POST `/api/tasks` - Create a new task
  - GET `/api/tasks/<id>` - Get a specific task
  - PUT `/api/tasks/<id>` - Update an existing task
  - DELETE `/api/tasks/<id>` - Delete a task
  - GET `/api/users` - List of users
  - POST `/api/users` - Create a new user
- Implementing input data validation
- Handling errors with the corresponding HTTP codes (400, 404, 500, etc.)
- Writing integration tests for the endpoints

**Deliverables**:
- A functional API that can be tested with tools such as `curl` or Postman
- Basic documentation of the endpoints (optional)

## Phase 4: Integration with the weather service

**Goal**: Adding the weather display functionality

### Activities:
- Creating the `src/weather/service.py` module
- Implementing the function to fetch the current weather and the forecast from the OpenWeatherMap API
- Adding API key management through environment variables
- Implementing temporary caching to reduce the number of API requests
- Creating the `/api/weather` endpoint to return the weather data
- Handling connection errors and rate limits
- Adding the relevant fields to the preferences model (city, temperature units)

**Deliverables**:
- The `/api/weather` endpoint that returns valid weather data
- The ability to specify the city and units through environment variables

## Phase 5: Integration with Ollama (AI)

**Goal**: Adding the functionality to interact with the AI model

### Activities:
- Creating the `src/ollama/client.py` module
- Implementing the functions for communicating with the Ollama server:
  - Simple text generation (`/api/generate`)
  - Structured conversation with context maintenance (`/api/chat`)
- Implementing the context management strategy (limited to the last N messages)
- Adding error handling (timeout, model not found, etc.)
- Retry mechanisms for temporary errors
- Creating the `/api/ai/chat` endpoint for interaction with the user
- Adding support for Romanian and English through detection and translation (if necessary)

**Deliverables**:
- The `/api/ai/chat` endpoint that can receive messages and return responses from Ollama
- The ability to maintain short context in conversations

## Phase 6: Basic frontend and layout

**Goal**: Creating the basic user interface

### Activities:
- Creating the base template `templates/base.html` with the common structure
- Implementing the basic CSS styles in `static/css/`
- Creating the main page `templates/index.html` with:
  - Header (date, weather, settings button)
  - Sidebar (user list)
  - Main area (for displaying tasks)
  - Footer (action buttons, voice indicator)
- Implementing the responsive layout with CSS Flexbox/Grid
- Adding the basic JavaScript files in `static/js/`

**Deliverables**:
- A user interface viewable in the browser at `http://localhost:5000`
- A basic layout that adapts to different screen sizes

## Phase 7: The task management interface

**Goal**: Implementing the complete task management functionality

### Activities:
- Implementing JavaScript for:
  - Displaying the task lists received from the API
  - Adding new tasks through forms
  - Editing existing tasks
  - Marking as done/refusing
  - Adding comments to tasks
- Creating the UI components for:
  - The add/edit task form
  - Displaying the details of a task
  - The comment list
- Implementing filtering tasks by day and user
- Adding status indicators (loading, errors, etc.)
- Implementing navigation between days (← → arrows)

**Deliverables**:
- A fully functional interface for managing tasks
- The ability to add, edit, delete and mark tasks
- A functional comment interface

## Phase 8: The voice interface (client-side)

**Goal**: Adding the voice command functionality through the browser

### Activities:
- Implementing the Web Speech API in JavaScript for:
  - Recognizing speech in Romanian and English
  - Activation through a button or a wakeword ("Hey HomeTasks")
  - Converting speech to text
- Adding a visual microphone status indicator (active/inactive)
- Implementing sending voice commands to the backend through the `/api/voice-command` endpoint
- Creating the voice command processing logic in the backend:
  - Detecting whether it is a system command or an AI query
  - Routing to the corresponding functions (adding a task, AI query, etc.)
- Implementing optional text-to-speech for responses (using the Web Speech API)
- Adding settings for the microphone sensitivity and the recognition language

**Deliverables**:
- A functional voice activation button in the footer
- The ability to add tasks through voice commands
- The ability to ask the AI questions by voice

## Phase 9: The AI chat interface

**Goal**: Implementing the conversation interface with the AI model

### Activities:
- Creating the chat UI component:
  - The message window
  - The text input field
  - The send button
- Implementing the JavaScript logic for:
  - Sending messages to the `/api/ai/chat` endpoint
  - Displaying responses in the chat window
  - Maintaining the conversation history in the current session
- Adding a "typing..." indicator while waiting for the AI's response
- Implementing automatic scrolling to new messages
- Adding the option to clear the conversation history
- Optimizing the prompts for relevant and short responses

**Deliverables**:
- A functional chat window that can communicate with Ollama
- The ability to ask questions about tasks, weather, etc. and receive useful answers

## Phase 10: Settings and customization

**Goal**: Allowing users to configure the application according to their preferences

### Activities:
- Creating the settings page accessible through the settings icon
- Implementing settings for:
  - General preferences (application language, date format, etc.)
  - User management (adding/editing/deleting users)
  - Weather configuration (city, temperature units, update frequency)
  - AI/Ollama settings (server address, model, temperature, etc.)
  - Voice settings (activation language, microphone sensitivity, TTS)
- Saving the settings in the database in the preferences table
- Loading the settings at application startup
- Implementing validation and visual feedback for setting changes

**Deliverables**:
- A fully functional settings page
- The ability to customize the application and persist the configuration between sessions

## Phase 11: Testing, optimization and deploy preparation

**Goal**: Ensuring quality, performance and preparation for the production environment

### Activities:
- Testing the application on different browsers (Chrome, Firefox, Safari) and devices (desktop, tablet, mobile)
- Testing the voice functionality in different lighting and noise conditions
- Optimizing performance:
  - Minimizing the CSS and JS files
  - Implementing caching for weather predictions
  - Optimizing the database queries
  - Reducing the number of unnecessary API requests
- Implementing improved error handling
- Adding loading messages and visual feedback
- Preparing for deploy:
  - Creating an example `.env` file for production
  - Documenting the steps for configuring Gunicorn or another WSGI server
  - Writing instructions for configuring it as a systemd service
- Writing integration tests for critical flows

**Deliverables**:
- A stable and performant application
- Complete deployment documentation
- All features tested and working correctly

## Suggested time frame

Phase | Estimated duration | Notes
-----|----------------|------------
1    | 1-2 days       | Essential preparation
2    | 2-3 days       | The database is fundamental
3    | 2-3 days       | The API enables parallel frontend development
4    | 1-2 days       | Depends on the external API
5    | 1-2 days       | Depends on the local Ollama server
6    | 2-3 days       | A basic frontend is needed to continue
7    | 3-5 days       | A substantial phase - the core of the application
8    | 2-3 days       | A relatively simple client-side implementation
9    | 2-3 days       | AI integration already built in phase 5
10   | 1-2 days       | Settings important for the user experience
11   | 2-3 days       | Ensures quality and prepares for production

**Total estimate**: 19-28 working days for an MVP (Minimum Viable Product) version

## Implementation tips

1. **Implement incrementally**: Deliver each phase completely before moving to the next
2. **Test continuously**: Verify the functionality at the end of each phase
3. **Refactor when necessary**: Don't hesitate to improve the code once you have basic functionality
4. **Keep the documentation up to date**: Update the README files and other docs as you progress
5. **Use git branches**: Work on dedicated branches for each major phase
6. **Ask for feedback**: Show the completed phases to some users for early feedback

This plan provides a clear path toward a fully functional, flexible and easy-to-maintain application. You can adapt the pace and order of the phases according to the available resources and your team's specific priorities.
