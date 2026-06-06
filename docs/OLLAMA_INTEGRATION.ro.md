# Integrare cu Ollama - HomeTasks

> [English](OLLAMA_INTEGRATION.md) · **Română**

## Arhitectura integrării

HomeTasks communicează cu serverul Ollama prin interfața HTTP REST pe portul 11434 (implicit). Toate cererile sunt efectuate către endpoint-ul `/api/generate` pentru generarea de text sau `/api/chat` pentru conversații structurate.

### Diagramă de comunicatie
```
Aplicație HomeTasks     <--HTTP/JSON-->     Server Ollama
        |                                       |
        |--- POST /api/generate --------------->|
        |                                       |
        |<-------------- Răspuns JSON ----------|
        |                                       |
        |--- POST /api/chat ------------------->|
        |                                       |
        |<-------------- Răspuns JSON ----------|
```

## Configurare inițială

### Setarea mediului
În fișierul `.env` al aplicației:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b  # sau alt model ales
OLLAMA_TIMEOUT=30       # secunde
OLLAMA_TEMPERATURE=0.7  # creativitate (0.0-1.0)
OLLAMA_MAX_TOKENS=500   # lungime maxima raspuns
```

### Verificare conectivitate
Aplicația verifică automat conectivitatea la Ollama la pornire și în intervale regulate prin:
1. Trimiterea unei cereri GET la `http://localhost:11434/api/version`
2. Interpretarea răspunsului pentru a confirma că serverul este disponibil
3. Logarea rezultatelor și notificarea utilizatorului în caz de eșec

## Modele recomandate

### Pentru înțelegere limbaj natural și generare de răspunsuri
| Model | Dimensiune | RAM necesara | Viteza | Calitate | Limbi suportate |
|-------|------------|--------------|--------|----------|-----------------|
| llama3:8b | 4.7GB | 4-6GB | Medie | Excelentă | Engleză, română (prin traducere) |
| phi3:medium | 2.5GB | 2-3GB | Rapidă | Buna | Engleză, limita română |
| mistral:7b | 4.1GB | 4-5GB | Medie | Excelentă | Multilingve (inclusiv română) |
| tinyllama:1.1b | 0.6GB | 1-1.5GB | Foarte rapidă | Limitata | Principal engleză |

### Recomandări specifice pentru HomeTasks
- **Prima alegere**: `llama3:8b` pentru cel mai bun echilibru între performare și calitate
- **Alternativă pentru resurse limitate**: `phi3:medium` sau `mistral:7b` cuantizat
- **pentru testare și dezvoltare**: `tinyllama:1.1b` pentru iterări rapide

## Descărcare și gestionare modele

### Descărcare model
```bash
ollama pull llama3:8b
```

### Listare modele disponibile
```bash
ollama list
```

### Ștergere model
```bash
ollama rm llama3:8b
```

### Actualizare model
```bash
ollama pull llama3:8b  # re-descarcă ultima versiune
```

## Endpoint-uri API utilizate

### Generare text simplu (`/api/generate`)
Folosit pentru interogări directe fără menținere de context.

**Cerere:**
```json
{
  "model": "llama3:8b",
  "prompt": "Ce tarea are Maria pentru astazi?",
  "stream": false,
  "options": {
    "temperature": 0.7,
    "max_tokens": 150
  }
}
```

**Răspuns:**
```json
{
  "model": "llama3:8b",
  "created_at": "2024-01-15T10:30:00Z",
  "response": "Maria are să cumpere lângă și pâine astazi la ora 10:00.",
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

### Conversație structurată (`/api/chat`)
Folosit pentru menținerea contextului în dialogurile continue.

**Cerere:**
```json
{
  "model": "llama3:8b",
  "messages": [
    {
      "role": "system",
      "content": "Ești un asistent tare pentru managementul taskurilor familiei. Răspunde scurt și util în limba română."
    },
    {
      "role": "user",
      "content": "Ce tarea are Maria pentru astazi?"
    }
  ],
  "stream": false,
  "options": {
    "temperature": 0.7
  }
}
```

**Răspuns:**
```json
{
  "model": "llama3:8b",
  "created_at": "2024-01-15T10:30:00Z",
  "message": {
    "role": "assistant",
    "content": "Maria are să cumpere lângă și pâine astazi la ora 10:00."
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

## Managementul contextului

### Strategii de manageare a contextului
1. **Context limitat**: Istoricul conversației este limitat la ultimele 5-10 mesaje pentru a preveni depășirea limitelor de tokeni
2. **Sumarizare**: Pentru conversații lungi, se generează periodic un sumar al discuției
3. **Context task-uri**: Contextul include informații relevante despre taskurile utilizatorului (din ultimele 24 de ore)
4. **Reset context**: Contextul este resetat după perioade de inactivitate (ex: 10 minute) sau la cererea explicită a utilizatorului

### Implementare tehnică
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
            # Eliminăm cele mai vechi mesaje, păstrând mesajul de sistem dacă există
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

## Suport pentru limba română și engleză

### Detectare limba
Aplicația detectează limba intrarerii utilizatorului prin:
1. Analiza caracterelor specifice (â, î, ț, ș pentru română)
2. Utilizarea de biblioteci de detectare a limbii (langdetect, fasttext)
3. Preferința de limba setată în profilul utilizatorului

### Traducere și generare
- Pentru modelele care nu au suport excelent pentru română (como llama3:8b de bază), se poate folosi:
  1. Traducerea intrarerii în engleză → procesare de la model → traducerea răspunsului în română
  2. Sau direct generare în română dacă modelul are suficiente antrenament lingvistic
- Modelele recomandate (mistral:7b, etc.) au suport bun pentru română nativ

### Exemple de interacție
**În română:**
- Utilizator: "Ce tarea are astazi pentru Ion?"
- AI: "Ion are să repară tapsa din bucătărie astazi seara la ora 18:00."

**În engleză:**
- Utilizator: "What tasks does Maria have today?"
- AI: "Maria needs to buy milk and bread today at 10:00 AM."

## Gestionarea erorilor și timeout-uri

### Tipuri de erori comune
1. **Conexiune refuzată**: Serverul Ollama nu rulează sau nu este accesibil
2. **Timeout**: Cererea a depășit limita de timp (implicit 30 secunde)
3. **Model negăsit**: Modelul specificat nu este descărcat pe server
4. **Erori de generare**: Probleme interne în modelul de AI

### Strategii de gestionare
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
        response.raise_for_status()  # Ridică excepție pentru coduri 4xx/5xx
        return response.json()
    
    except requests.exceptions.ConnectionError:
        raise OllamaConnectionError(
            "Nu se poate conecta la serverul Ollama. Verificați dacă serviciul rulează."
        )
    
    except requests.exceptions.Timeout:
        raise OllamaTimeoutError(
            f"Cererea la Ollama a expirat după {timeout} secunde."
        )
    
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            raise OllamaModelNotFoundError(
                f"Modelul {self.model} nu a fost găsit pe server."
            )
        else:
            raise OllamaAPIError(
                f"Eroare de la API-ul Ollama: {e.response.status_code}"
            )
    
    except json.JSONDecodeError:
        raise OllamaInvalidResponseError(
            "Răspunsul primit de la Ollama nu este un JSON valid."
        )
```

### Mecanisme de retry
- Pentru erori temporare (conexiune, timeout), se aplică până la 3 încercări cu backoff exponential
- Între încercări se așteaptă: 1s, 2s, 4s
- După eșecul tuturor încercărilor, se notifică utilizatorul și se ofere opțiunea să încearcă manual

## Performanță și optimizare

### Técnici de reducere a latenței
1. **Încărcare anticipată**: Modelul este încărcat în memorie la pornirea aplicației (pozând resurse, dar reducând latența primului răspuns)
2. **Batch processing**: Cereri similare sunt grupată (deși Ollama nu susține native batching, se poate implementa la nivel de aplicație)
3. **Cache de răspunsuri**: Pentru întrebări frecvente și repetitive (ex: "Ce vreme azi?"), se cachează răspunsurile pentru perioade scurte (5-15 minute)
4. **Optimizare prompt-uri**: Promptele sunt formulate concis pentru a reduce numărul de tokeni de intrare

### Monitorizare resurse
- Utilizarea de RAM este monitorizată și avertizări sunt generate dacă depășește 80% din total
- Dacă utilizarea RAM-ului depășește o fază critică, aplicația poate:
  - Temporar dezactiva funcțiile AI non-essențiale
  - Reduce lungimea maxima a răspunsurilor
  - Sugerează utilizatorului să repornească cu un model mai mic

### Setări de performanță recomandate
```env
# Pentru Raspberry Pi 4 cu 4GB RAM
OLLAMA_MODEL=llama3:8b
OLLAMA_NUM_CTX=2048       # dimensiunea contextului (implicit 2048)
OLLAMA_NUM_BATCH=8        # dimensiunea batch-ului pentru procesare
OLLAMA_NUM_THREAD=4       # numarul de fire CPU de utilizat
OLLAMA_TIMEOUT=30
OLLAMA_TEMPERATURE=0.7
OLLAMA_MAX_TOKENS=300
```

## Securitate și confidențialitate

### Protejarea datelor
- Toate comunicările cu Ollama rulează pe localhost (127.0.0.1) prin implicit, eliminând riscul de interceptare de rețea
- Dacă serverul Ollama este pe alt dispozitiv în rețea locală, se recomandă utilizarea de firewall-uri pentru a restricționa accesul doar la dispozitivele de încredere
- Nu se trimit date personale sensible (ex: numele complet, adrese) către model decât stricte necesar

### Minimizarea datelor transmise
- Promptele includ doar informațiile esențiale pentru a genera răspunsul relevant
- Datele de taskuri sunt transmise doar în format agregat (ex: "Maria are 3 taskuri astazi") în loc de liste detaliate dacă nu sunt necesare
- Istoricul conversației nu este stocat pe termen lung și este șters automat după periode de inactivitate

## Testarea integrării

### Teste unitare pentru clientul Ollama
```python
def test_ollama_client_initialization():
    client = OllamaClient("http://localhost:11434", "llama3:8b")
    assert client.host == "http://localhost:11434"
    assert client.model == "llama3:8b"

def test_ollama_client_chat_success(mocker):
    mock_post = mocker.patch('requests.post')
    mock_post.return_value.json.return_value = {
        "message": {"role": "assistant", "content": "Răspuns de test"}
    }
    
    client = OllamaClient("http://localhost:11434", "llama3:8b")
    response = client.chat("Mesaj de test")
    
    assert response == "Răspuns de test"
    assert len(client.conversation_history) == 2  # user + assistant
```

### Teste de integrare
1. Verificare că aplicația pornește corect chiar și atunci când Ollama nu este disponibil (cu mesaj de eroare corespunzător)
2. Testarea trimiterei unei interogări simple și primirea unui răspuns valid
3. Testarea menținerii contextului prin mesaje multiple
4. Verificarea gestionarii erorilor (model negăsit, timeout, etc.)
5. Testarea suportului pentru limba română și engleză

## Depanare a problemelor comune

### Problem: "Connection refused" la conectare la Ollama
**Posibile cauze:**
- Serverul Ollama nu rulează
- Serverul Ollama rulează pe alt port
- Un firewall blochează conexiunea

**Soluții:**
1. Verificați starea serverului: `ps aux | grep ollama`
2. Porniți serverul manual: `ollama serve &`
3. Verificați portul: `netstat -tuln | grep 11434`
4. Adjustați fișierul `.env` dacă Ollama rulează pe alt host/port
5. Verificați regulile de firewall: `sudo ufw status` sau `sudo iptables -L`

### Problem: "Model not found"
**Posibile cauze:**
- Modelul nu a fost descărcat
- Numele modelului este greșit
- Spațiul insuficient pe disc pentru model

**Soluții:**
1. Listați modelele disponibile: `ollama list`
2. Descărcați modelul lipsă: `ollama pull llama3:8b`
3. Verificați spațiul pe disc: `df -h`
4. Curățați spațiul eliminând modelele nefolosite: `ollama rm model_vechi`

### Problem: Răspunsuri lente sau timeout-uri
**Posibile cauze:**
- Modelul este prea mare pentru RAM-ul disponibil
- Utilizarea ridicată de CPU de către alte procese
- Prompt-uri prea lungi care necesită multe tokeni de procesare

**Soluții:**
1. Monitorizați resursele: `top` sau `htop`
2. Schimbați la un model mai mic (ex: phi3:medium)
3. Reduceți `OLLAMA_MAX_TOKENS` în fișierul `.env`
4. Asigurați-vă că nu există alte aplicații consumatoare de resurse
5. Creșteți valoarea `OLLAMA_TIMEOUT` dacă este necesar (nu recomandat peste 60s)

### Problem: Răspunsuri inadecvate sau în limba greșită
**Posibile cauze:**
- Modelul nu are suficient antrenament în limba română
- Prompt-ul nu specifică clar limba dorită
- Setările de temperatură sunt prea ridicate, generând răspunsuri necoerente

**Soluții:**
1. Folosiți un model cu suport bun pentru română (mistral:7b)
2. Adăugați instrucțiuni clare în prompt: "Răspunde în limba română."
3. Reduceți temperatura: `OLLAMA_TEMPERATURE=0.3` pentru răspunsuri mai deterministe
4. Furnizați mai multe context în prompt pentru a ajuta modelul să înțelege cererea

## Plan de dezvoltare viitoare

### Funcționalități planificate
1. **Fine-tuning local**: Capacitatea de să antrena adaptați modelul pe datele specifice familiei (taskuri preferate, stil de comunicare)
2. **Modelе multiple**: Capacitatea de să comute între modele diferite în funcție de tipul de interogare (ex: model mic pentru comenzi simple, model mare pentru conversații complexe)
3. **Optimizare cu quantization**: Utilizarea de modele cuantizate (GGUF) pentru a reduce utilizarea de RAM fără pierdere semnificativă de calitate
4. **Integrare cu Vector DB**: Stocarea embeddings-elor taskurilor pentru căutare semantică mai rapidă
5. **Asistente personalizate**: Crearea de profile de AI pentru diferiți membri ai familiei cu stiluri de comunicare distincte

### Îmbunătățiri de performanță
1. **Servire concurentă**: Implementarea unui mic serviciu de intermediary care să gestioneze concurrenty cererile catre Ollama
2. **Predictive prefetching**: Încărcarea anticipată a modelului în perioade de utilizare scăzută a resurselor
3. **Hardware acceleration**: Explorarea utilizarii GPU-ului (dacă disponibil prin comenzi externe) pentru accelerația inferenței
4. **Model sharding**: Distribuirea modelelor pe multe dispozitive în rețea locală pentru a respira consträngerile de RAM pe un singur nod