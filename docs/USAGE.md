# Usage guide - HomeTasks (Web)

> **English** · [Română](USAGE.ro.md)

## Opening and basic navigation

### Starting the application
1. Make sure the Ollama server is running in the background (`ollama serve`)
2. Navigate to the application directory: `cd HomeTasks/src`
3. Run the application: `python main.py`
4. Open the browser and navigate to: `http://localhost:5000`
   - For access from other devices on the local network: `http://<raspberry-pi-ip>:5000`
   - Example: `http://192.168.1.100:5000`

### Structure of the main page
The page is divided into main sections:
- **Header (top area)**: Current date, weather information and settings button
- **Sidebar (left area)**: List of family users (each with a distinct color)
- **Main content (central area)**: List of tasks for the selected day
- **Footer (bottom area)**: Quick action buttons and voice command indicator

## Viewing tasks

### Selecting the day
- To see the tasks for a specific day, click the date in the header
- Use the ← → arrows to navigate between previous and following days
- At startup, the application automatically displays the tasks for the current day and the next 7 days

### Viewing tasks per user
- Click a user's name in the sidebar to see only their tasks
- To see all users' tasks, click "All" or the empty space in the sidebar
- Tasks are colored according to the assigned user (the same color as in the user list)

### Task details
- Hover over a task with the mouse or tap it (on touch devices) to see additional details:
  - The full description
  - The scheduled date and time
  - The assigned user
  - Attached comments
  - Action buttons (Close, Refuse, Edit)

## Adding tasks

### Through the web interface
1. Click the "+" button in the footer or the "+" icon next to the date in the header
2. Select the user the task is assigned to (optional - leave blank to assign to multiple users)
3. Enter the task description in the text field
4. Select the date and time (optional - defaults to today)
5. Click "Save" to confirm

### Through a voice command (browser)
1. Make sure you are on `localhost` or on an HTTPS connection (required for the Web Speech API for security reasons)
2. Click the microphone icon in the footer
3. After you hear the confirmation beep, say your request:
   - In Romanian: "Adaugă un task pentru [name]: [description] pe [date] la [time]"
   - In English: "Add a task for [name]: [description] on [date] at [time]"
4. Examples:
   - "Adaugă un task pentru Maria: Cumpără lapte și pâine mâine la 10:00"
   - "Add a task for John: Fix the leaky faucet tomorrow at 2pm"
5. The system will confirm the added task with a visual message (toast notification)
6. Optionally: If enabled, you will also hear a voice confirmation message via the browser's speech synthesis

## Adding comments to tasks

### Through the web interface
1. Hover over the task you want to add a comment to or tap it (on touch devices)
2. Select the "Add comment" option
3. Enter the comment text in the field that appears
4. Tap "Send" to save the comment

### Through a voice command
1. Activate the voice module via the microphone icon in the footer
2. Say: "Add a comment to the task [short description/task ID]: [comment text]"
3. Example: "Add a comment to the task Buy milk: I found milk at the corner store"
4. The system will look for the matching task and attach the comment
5. You will receive a success notification

## Changing task status

### Closing a task
1. Hover over the completed task or tap it
2. Select the "Mark as done" option
3. The task will appear with a line through the text and will be moved to the "Completed tasks" section (if enabled)

### Refusing a task
1. Hover over the task you are refusing or tap it
2. Select the "Refuse task" option
3. Enter a reason for refusal (optional but recommended)
4. The task will be marked as refused and will appear grayed out

### Reopening a task
1. Access the "Completed/refused tasks" section via the corresponding button in the footer
2. Long-press the task you want to reopen
3. Select "Reopen task"
4. The task will return to the active list with its previous status

## Interacting with the AI model

### Through the web interface
1. Click the robot icon in the footer
2. Enter your question in the text field that appears
3. Click "Send" to get the AI's response
4. The response will appear in the conversation window

### Through a voice command
1. Activate the voice module via the microphone icon in the footer
2. Ask your question directly (without specifying that it's for the AI - the system detects it automatically):
   - "What will the weather be tomorrow?"
   - "Suggest me a recipe for dinner with the ingredients in the fridge"
   - "What tasks does Maria have for next week?"
3. The system will send the question to the Ollama model and return the response
4. The response will be displayed visually in the conversation window
5. Optionally: If enabled, you will also hear a voice message with the response via the browser's speech synthesis

## Customizing the application

### Accessing the settings
1. Click the settings icon (gear) in the top right corner of the header
2. The settings menu contains:
   - General preferences
   - User settings
   - Weather configuration
   - AI/Ollama settings
   - Voice settings
   - Information about the application

### User management
1. In the Settings → Users menu
2. To add a new user:
   - Click "+ Add user"
   - Enter the name and select a color
   - (Optional) Add a photo or avatar
3. To edit an existing user:
   - Click the user's name
   - Change the desired data
4. To delete a user:
   - Long-press the user's name (on desktop) or do a long press (on mobile) and select "Delete"

### Weather settings
1. In the Settings → Weather menu
2. Enter:
   - The city you want the forecast for (auto-detected by IP or GPS on mobile devices by default)
   - The temperature unit (°C or °F)
   - The update frequency (15, 30, 60 minutes)
   - The API key for the chosen weather service (OpenWeatherMap, etc.)

### AI/Ollama settings
1. In the Settings → AI/Ollama menu
2. Configure:
   - The Ollama server address (default: http://localhost:11434)
   - The model to use (llama3:8b, phi3:medium, etc.)
   - The model temperature (0.0-1.0, where 0.0 is more deterministic)
   - The maximum response length (in tokens)
   - The request timeout (in seconds)

### Voice settings
1. In the Settings → Voice menu
2. Configure:
   - The activation language (Romanian/English/both) - to indicate the preferred language
   - The microphone sensitivity (only for optional server-side implementations)
   - The voice recognition language (ro-RO, en-US, en-GB) - a hint for the browser
   - Enable/disable speech synthesis for AI responses and notifications
   - The audio output volume (only for speech synthesis)

## Resolving common problems

### The application doesn't start
- Check that Python 3.9+ is installed: `python --version`
- Make sure all dependencies are installed: `pip install -r src/requirements.txt`
- Check that the Ollama server is running: `curl http://localhost:11434/api/version`

### The voice command doesn't work in the browser
- Make sure you are on `http://localhost:5000` or on an HTTPS connection (the Web Speech API requires this for security reasons)
- Check the browser's privacy settings to allow microphone access
- Test the microphone with a microphone-testing web app (e.g. https://mictester.com/)
- In the voice settings, check that you selected the correct recognition language
- Make sure there are no blocking applications using the microphone

### You can't access the weather information
- Check the internet connection
- Make sure the API key is correct and active
- Check the daily request limit for the chosen weather service
- In the weather settings, select a different service or reload the API key

### The AI model doesn't respond or is slow
- Make sure the Ollama server is running: `ollama list`
- Check that the selected model is downloaded: `ollama show llama3:8b`
- If you use a large model, make sure you have enough free RAM
- Lower the model temperature for faster and more deterministic responses

### Tasks aren't being saved
- Check the write permissions in the application directory
- Make sure the disk storage space is not exhausted
- Check that the SQLite database is not corrupted (the `data/hometask.db` file)

## Tips for efficient use

### Organizing tasks
- Use clear prefixes in descriptions: [BUY], [FIX], [CALL], etc.
- Assign specific times to tasks to avoid scheduling conflicts
- Review tasks at the beginning of each week and update priorities

### Using voice commands
- Speak clearly and at a moderate pace for the best recognition results
- In noisy environments, try to reduce background noise or move the microphone closer to your mouth
- Use consistent activation phrases to reduce the chance of accidental activations
- If you use voice commands frequently, use an external microphone for better quality

### System maintenance
- Run a monthly check of the available storage space
- Update the Ollama model regularly to benefit from improvements
- Periodically clear the application's cache memory via the option in the settings
- Back up the database file monthly

## Accessing help and support

### Internal documentation
- Access the "Help" section in the settings menu for quick guides
- View the integrated tutorial videos via links in the Help menu

### Online resources
- Project wiki: https://github.com/dvaduva/HomeTasks/wiki
- Discussion forum: https://community.hometask.app
- Report issues: https://github.com/dvaduva/HomeTasks/issues

### Contact
- For critical problems: support@hometask.app
- For general questions: info@hometask.app
