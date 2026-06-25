# Ollama integration - HomeTasks

> **English** · [Română](OLLAMA_INTEGRATION.ro.md)

> **Note:** Ollama is the local, default AI provider. HomeTasks can also use free
> cloud tiers (OpenRouter, Groq, Mistral, Gemini). For choosing and configuring a
> provider, see [AI_PROVIDERS.md](AI_PROVIDERS.md). This document covers the
> Ollama-specific details.

## Integration architecture

HomeTasks communicates with the Ollama server through the HTTP REST interface on port 11434 (default). All requests are made to the `/api/generate` endpoint for text generation or `/api/chat` for structured conversations.

### Communication diagram
```
HomeTasks application   <--HTTP/JSON-->     Ollama Server
        |                                       |
        |--- POST /api/generate --------------->|
        |                                       |
        |<-------------- JSON response ---------|
        |                                       |
        |--- POST /api/chat ------------------->|
        |                                       |
        |<-------------- JSON response ---------|
```

## Initial configuration

### Setting the environment
In the application's `.env` file:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b  # or another chosen model
OLLAMA_TIMEOUT=30       # seconds
OLLAMA_TEMPERATURE=0.7  # creativity (0.0-1.0)
OLLAMA_MAX_TOKENS=500   # maximum response length
```

### Connectivity check
The application automatically checks connectivity to Ollama at startup and at regular intervals by:
1. Sending a GET request to `http://localhost:11434/api/version`
2. Interpreting the response to confirm that the server is available
3. Logging the results and notifying the user in case of failure

## Recommended models

### For natural language understanding and response generation
| Model | Size | RAM needed | Speed | Quality | Supported languages |
|-------|------|------------|-------|---------|---------------------|
| llama3:8b | 4.7GB | 4-6GB | Medium | Excellent | English, Romanian (via translation) |
| phi3:medium | 2.5GB | 2-3GB | Fast | Good | English, limited Romanian |
| mistral:7b | 4.1GB | 4-5GB | Medium | Excellent | Multilingual (including Romanian) |
| tinyllama:1.1b | 0.6GB | 1-1.5GB | Very fast | Limited | Mainly English |

### Specific recommendations for HomeTasks
- **First choice**: `llama3:8b` for the best balance between performance and quality
- **Alternative for limited resources**: `phi3:medium` or a quantized `mistral:7b`
- **For testing and development**: `tinyllama:1.1b` for fast iterations

## Downloading and managing models

### Download a model
```bash
ollama pull llama3:8b
```

### List available models
```bash
ollama list
```

### Remove a model
```bash
ollama rm llama3:8b
```

### Update a model
```bash
ollama pull llama3:8b  # re-downloads the latest version
```

## API endpoints used

### Simple text generation (`/api/generate`)
Used for direct queries without maintaining context.

**Request:**
```json
{
  "model": "llama3:8b",
  "prompt": "What tasks does Maria have for today?",
  "stream": false,
  "options": {
    "temperature": 0.7,
    "max_tokens": 150
  }
}
```

**Response:**
```json
{
  "model": "llama3:8b",
  "created_at": "2024-01-15T10:30:00Z",
  "response": "Maria needs to buy milk and bread today at 10:00.",
  "done": true,
  "context": [1, 2, 3, ...],
  "total_duration": 1250000000,
  "load_duration": 50000000,
  "prompt_eval_count": 10,
  "prompt_eval_duration": 300000000,
  "eval_count": 25,
  "eval_duration": 800000000
}
```

### Structured conversation (`/api/chat`)
Used for maintaining context in continuous dialogues.

**Request:**
```json
{
  "model": "llama3:8b",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant for managing family tasks. Respond briefly and usefully."
    },
    {
      "role": "user",
      "content": "What tasks does Maria have for today?"
    }
  ],
  "stream": false,
  "options": {
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "model": "llama3:8b",
  "created_at": "2024-01-15T10:30:00Z",
  "message": {
    "role": "assistant",
    "content": "Maria needs to buy milk and bread today at 10:00."
  },
  "done": true,
  "total_duration": 1250000000,
  "load_duration": 50000000,
  "prompt_eval_count": 15,
  "prompt_eval_duration": 350000000,
  "eval_count": 20,
  "eval_duration": 800000000
}
```

## Context management

### Context management strategies
1. **Limited context**: The conversation history is limited to the last 5-10 messages to prevent exceeding token limits
2. **Summarization**: For long conversations, a summary of the discussion is generated periodically
3. **Task context**: The context includes relevant information about the user's tasks (from the last 24 hours)
4. **Context reset**: The context is reset after periods of inactivity (e.g. 10 minutes) or at the user's explicit request

### Technical implementation
```python
class OllamaClient:
    def __init__(self, host, model):
        self.host = host
        self.model = model
        self.conversation_history = []
        self.max_history_length = 10

    def add_to_history(self, role, content):
        self.conversation_history.append({"role": role, "content": content})
        if len(self.conversation_history) > self.max_history_length:
            # Remove the oldest messages, keeping the system message if it exists
            if self.conversation_history[0]["role"] == "system":
                self.conversation_history = [self.conversation_history[0]] + \
                                          self.conversation_history[-(self.max_history_length-1):]
            else:
                self.conversation_history = self.conversation_history[-self.max_history_length:]

    def chat(self, message):
        self.add_to_history("user", message)

        payload = {
            "model": self.model,
            "messages": self.conversation_history,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "max_tokens": 500
            }
        }

        response = requests.post(f"{self.host}/api/chat", json=payload)
        result = response.json()

        assistant_message = result["message"]["content"]
        self.add_to_history("assistant", assistant_message)

        return assistant_message
```

## Support for Romanian and English

### Language detection
The application detects the language of the user's input through:
1. Analysis of specific characters (â, î, ț, ș for Romanian)
2. Use of language detection libraries (langdetect, fasttext)
3. The language preference set in the user's profile

### Translation and generation
- For models that do not have excellent Romanian support (such as the base llama3:8b), you can use:
  1. Translating the input into English → processing by the model → translating the response into Romanian
  2. Or generating directly in Romanian if the model has enough linguistic training
- The recommended models (mistral:7b, etc.) have good native Romanian support

### Interaction examples
**In Romanian:**
- User: "Ce taskuri are azi pentru Ion?"
- AI: "Ion trebuie să repare robinetul din bucătărie azi seară la ora 18:00."

**In English:**
- User: "What tasks does Maria have today?"
- AI: "Maria needs to buy milk and bread today at 10:00 AM."

## Error handling and timeouts

### Common error types
1. **Connection refused**: The Ollama server is not running or is not accessible
2. **Timeout**: The request exceeded the time limit (default 30 seconds)
3. **Model not found**: The specified model is not downloaded on the server
4. **Generation errors**: Internal problems in the AI model

### Handling strategies
```python
def safe_ollama_request(self, endpoint, payload, timeout=None):
    if timeout is None:
        timeout = self.timeout

    try:
        response = requests.post(
            f"{self.host}{endpoint}",
            json=payload,
            timeout=timeout
        )
        response.raise_for_status()  # Raises an exception for 4xx/5xx codes
        return response.json()

    except requests.exceptions.ConnectionError:
        raise OllamaConnectionError(
            "Cannot connect to the Ollama server. Check whether the service is running."
        )

    except requests.exceptions.Timeout:
        raise OllamaTimeoutError(
            f"The request to Ollama timed out after {timeout} seconds."
        )

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            raise OllamaModelNotFoundError(
                f"The model {self.model} was not found on the server."
            )
        else:
            raise OllamaAPIError(
                f"Error from the Ollama API: {e.response.status_code}"
            )

    except json.JSONDecodeError:
        raise OllamaInvalidResponseError(
            "The response received from Ollama is not valid JSON."
        )
```

### Retry mechanisms
- For temporary errors (connection, timeout), up to 3 attempts are made with exponential backoff
- Between attempts it waits: 1s, 2s, 4s
- After all attempts fail, the user is notified and offered the option to try again manually

## Performance and optimization

### Latency reduction techniques
1. **Preloading**: The model is loaded into memory at application startup (costing resources, but reducing the first-response latency)
2. **Batch processing**: Similar requests are grouped (although Ollama does not support native batching, it can be implemented at the application level)
3. **Response cache**: For frequent and repetitive questions (e.g. "What's the weather today?"), responses are cached for short periods (5-15 minutes)
4. **Prompt optimization**: Prompts are phrased concisely to reduce the number of input tokens

### Resource monitoring
- RAM usage is monitored and warnings are generated if it exceeds 80% of the total
- If RAM usage reaches a critical level, the application can:
  - Temporarily disable non-essential AI features
  - Reduce the maximum response length
  - Suggest that the user restart with a smaller model

### Recommended performance settings
```env
# For a Raspberry Pi 4 with 4GB RAM
OLLAMA_MODEL=llama3:8b
OLLAMA_NUM_CTX=2048       # context size (default 2048)
OLLAMA_NUM_BATCH=8        # batch size for processing
OLLAMA_NUM_THREAD=4       # number of CPU threads to use
OLLAMA_TIMEOUT=30
OLLAMA_TEMPERATURE=0.7
OLLAMA_MAX_TOKENS=300
```

## Security and privacy

### Protecting the data
- All communication with Ollama runs on localhost (127.0.0.1) by default, eliminating the risk of network interception
- If the Ollama server is on another device on the local network, using firewalls to restrict access only to trusted devices is recommended
- No sensitive personal data (e.g. full name, addresses) is sent to the model unless strictly necessary

### Minimizing transmitted data
- Prompts include only the essential information needed to generate the relevant response
- Task data is transmitted only in aggregate form (e.g. "Maria has 3 tasks today") instead of detailed lists if they are not necessary
- The conversation history is not stored long-term and is deleted automatically after periods of inactivity

## Testing the integration

### Unit tests for the Ollama client
```python
def test_ollama_client_initialization():
    client = OllamaClient("http://localhost:11434", "llama3:8b")
    assert client.host == "http://localhost:11434"
    assert client.model == "llama3:8b"

def test_ollama_client_chat_success(mocker):
    mock_post = mocker.patch('requests.post')
    mock_post.return_value.json.return_value = {
        "message": {"role": "assistant", "content": "Test response"}
    }

    client = OllamaClient("http://localhost:11434", "llama3:8b")
    response = client.chat("Test message")

    assert response == "Test response"
    assert len(client.conversation_history) == 2  # user + assistant
```

### Integration tests
1. Verify that the application starts correctly even when Ollama is unavailable (with an appropriate error message)
2. Test sending a simple query and receiving a valid response
3. Test maintaining context across multiple messages
4. Verify error handling (model not found, timeout, etc.)
5. Test support for Romanian and English

## Troubleshooting common problems

### Problem: "Connection refused" when connecting to Ollama
**Possible causes:**
- The Ollama server is not running
- The Ollama server is running on a different port
- A firewall is blocking the connection

**Solutions:**
1. Check the server status: `ps aux | grep ollama`
2. Start the server manually: `ollama serve &`
3. Check the port: `netstat -tuln | grep 11434`
4. Adjust the `.env` file if Ollama runs on a different host/port
5. Check the firewall rules: `sudo ufw status` or `sudo iptables -L`

### Problem: "Model not found"
**Possible causes:**
- The model has not been downloaded
- The model name is wrong
- Insufficient disk space for the model

**Solutions:**
1. List the available models: `ollama list`
2. Download the missing model: `ollama pull llama3:8b`
3. Check the disk space: `df -h`
4. Free up space by removing unused models: `ollama rm old_model`

### Problem: Slow responses or timeouts
**Possible causes:**
- The model is too large for the available RAM
- High CPU usage by other processes
- Prompts that are too long and require many tokens to process

**Solutions:**
1. Monitor the resources: `top` or `htop`
2. Switch to a smaller model (e.g. phi3:medium)
3. Reduce `OLLAMA_MAX_TOKENS` in the `.env` file
4. Make sure there are no other resource-consuming applications
5. Increase the `OLLAMA_TIMEOUT` value if necessary (not recommended above 60s)

### Problem: Inadequate responses or wrong language
**Possible causes:**
- The model does not have enough training in Romanian
- The prompt does not clearly specify the desired language
- The temperature settings are too high, generating incoherent responses

**Solutions:**
1. Use a model with good Romanian support (mistral:7b)
2. Add clear instructions in the prompt: "Respond in Romanian."
3. Reduce the temperature: `OLLAMA_TEMPERATURE=0.3` for more deterministic responses
4. Provide more context in the prompt to help the model understand the request

## Future development plan

### Planned features
1. **Local fine-tuning**: The ability to adapt the model to the family's specific data (preferred tasks, communication style)
2. **Multiple models**: The ability to switch between different models depending on the query type (e.g. a small model for simple commands, a large model for complex conversations)
3. **Optimization with quantization**: Using quantized models (GGUF) to reduce RAM usage without a significant loss of quality
4. **Vector DB integration**: Storing task embeddings for faster semantic search
5. **Personalized assistants**: Creating AI profiles for different family members with distinct communication styles

### Performance improvements
1. **Concurrent serving**: Implementing a small intermediary service to manage concurrent requests to Ollama
2. **Predictive prefetching**: Preloading the model during periods of low resource usage
3. **Hardware acceleration**: Exploring GPU usage (if available through external commands) to accelerate inference
4. **Model sharding**: Distributing models across multiple devices on the local network to relax the RAM constraints on a single node
