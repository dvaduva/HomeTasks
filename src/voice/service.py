"""
Voice service module for HomeTasks.
Handles speech recognition and text-to-speech functionality.
"""

import logging
import os
import threading
import queue
import time
from typing import Optional, Callable

logger = logging.getLogger(__name__)


def _resolve_mic_device_index() -> Optional[int]:
    """Pick the capture device for SpeechRecognition.

    On a headless RPi the ALSA ``default`` device often isn't the USB mic, so we
    let the deploy point at the right one via .env:
      - VOICE_MIC_DEVICE_INDEX — explicit PortAudio index (wins if set);
      - VOICE_MIC_DEVICE_NAME  — case-insensitive substring matched against the
        device list (e.g. "USB"), robust to index shuffles across reboots.
    Returns None (system default) when neither is set — keeps dev/Windows as-is.
    """
    idx = os.getenv("VOICE_MIC_DEVICE_INDEX", "").strip()
    if idx:
        try:
            return int(idx)
        except ValueError:
            logger.warning("VOICE_MIC_DEVICE_INDEX=%r is not an integer; ignoring", idx)

    name = os.getenv("VOICE_MIC_DEVICE_NAME", "").strip()
    if not name:
        return None
    try:
        import speech_recognition as sr
        for i, device_name in enumerate(sr.Microphone.list_microphone_names()):
            if name.lower() in device_name.lower():
                logger.info("Mic device matched '%s' -> index %d (%s)", name, i, device_name)
                return i
        logger.warning("No mic device matched VOICE_MIC_DEVICE_NAME=%r; using system default", name)
    except Exception as e:
        logger.warning("Mic device name resolution failed: %s", e)
    return None

class VoiceService:
    """Service for handling voice commands and speech synthesis."""
    
    def __init__(self):
        self.is_listening = False
        self.speech_recognition_available = False
        self.text_to_speech_available = False
        self.callback: Optional[Callable[[str], None]] = None
        self.audio_queue = queue.Queue()
        self.language = "ro-RO"  # Default language
        self.sensitivity = 0.5   # Default sensitivity
        
        # Try to initialize speech recognition
        try:
            import speech_recognition as sr
            self.recognizer = sr.Recognizer()
            self.mic_device_index = _resolve_mic_device_index()
            self.microphone = sr.Microphone(device_index=self.mic_device_index)
            self.speech_recognition_available = True
            logger.info("Speech recognition initialized (mic device index: %s)", self.mic_device_index)
        except ImportError:
            logger.warning("SpeechRecognition library not available. Voice input disabled.")
        except Exception as e:
            logger.warning(f"Failed to initialize speech recognition: {e}")
        
        # Try to initialize text-to-speech
        try:
            import pyttsx3
            self.tts_engine = pyttsx3.init()
            self.text_to_speech_available = True
            logger.info("Text-to-speech initialized successfully")
        except ImportError:
            logger.warning("pyttsx3 library not available. Text-to-speech disabled.")
        except Exception as e:
            logger.warning(f"Failed to initialize text-to-speech: {e}")
    
    def update_settings(self, language: str = None, sensitivity: float = None):
        """
        Update voice service settings.
        
        Args:
            language: Language code for speech recognition (e.g., "ro-RO")
            sensitivity: Microphone sensitivity (0.0 to 1.0)
        """
        if language is not None:
            self.language = language
            logger.info(f"Voice language updated to: {language}")
        
        if sensitivity is not None:
            self.sensitivity = max(0.0, min(1.0, sensitivity))  # Clamp to 0-1 range
            logger.info(f"Voice sensitivity updated to: {sensitivity}")
    
    def start_listening(self, callback: Callable[[str], None]):
        """
        Start listening for voice commands.
        
        Args:
            callback: Function to call with recognized text
        """
        if not self.speech_recognition_available:
            logger.error("Speech recognition not available")
            return False
            
        if self.is_listening:
            logger.warning("Already listening")
            return False
            
        self.callback = callback
        self.is_listening = True
        
        # Start listening in a separate thread
        self.listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.listen_thread.start()
        
        logger.info("Started listening for voice commands")
        return True
    
    def stop_listening(self):
        """Stop listening for voice commands."""
        self.is_listening = False
        if hasattr(self, 'listen_thread'):
            self.listen_thread.join(timeout=1.0)
        logger.info("Stopped listening for voice commands")
    
    def _listen_loop(self):
        """Main listening loop running in separate thread."""
        if not self.speech_recognition_available:
            return
            
        try:
            with self.microphone as source:
                # Adjust for ambient noise based on sensitivity
                adjust_duration = max(0.5, 2.0 * (1.0 - self.sensitivity))  # Less adjustment for higher sensitivity
                self.recognizer.adjust_for_ambient_noise(source, duration=adjust_duration)
                logger.info(f"Microphone calibrated for ambient noise (duration: {adjust_duration}s)")
                
                while self.is_listening:
                    try:
                        logger.debug("Listening for audio...")
                        # Adjust phrase time limit based on sensitivity
                        phrase_time_limit = max(3, int(10 * self.sensitivity))  # 3-10 seconds
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=phrase_time_limit)
                        logger.debug("Audio captured, processing...")
                        
                        # Use Google Speech Recognition with selected language
                        text = self.recognizer.recognize_google(audio, language=self.language)
                        logger.info(f"Recognized speech: {text}")
                        
                        if self.callback and text.strip():
                            self.callback(text.strip())
                            
                    except sr.WaitTimeoutError:
                        # Timeout is expected, just continue listening
                        continue
                    except sr.UnknownValueError:
                        logger.debug("Speech not understood")
                        continue
                    except sr.RequestError as e:
                        logger.error(f"Could not request results from speech recognition service: {e}")
                        time.sleep(1)  # Wait before retrying
                    except Exception as e:
                        logger.error(f"Error in speech recognition loop: {e}")
                        time.sleep(1)
                        
        except Exception as e:
            logger.error(f"Failed to initialize microphone: {e}")
        finally:
            self.is_listening = False
    
    def speak_text(self, text: str):
        """
        Convert text to speech.
        
        Args:
            text: Text to speak
        """
        if not self.text_to_speech_available:
            logger.warning("Text-to-speech not available")
            return False
            
        try:
            self.tts_engine.say(text)
            self.tts_engine.runAndWait()
            logger.info(f"Spoke text: {text}")
            return True
        except Exception as e:
            logger.error(f"Error in text-to-speech: {e}")
            return False
    
    def is_available(self) -> dict:
        """
        Check availability of voice services.
        
        Returns:
            Dictionary with availability status
        """
        return {
            'speech_recognition': self.speech_recognition_available,
            'text_to_speech': self.text_to_speech_available,
            'listening': self.is_listening,
            'language': self.language,
            'sensitivity': self.sensitivity
        }

    @staticmethod
    def list_microphones() -> list:
        """List capture-capable audio devices for the Settings UI.

        Returns a list of {'index': int, 'name': str}, filtered to devices that
        actually expose input channels (skips output-only cards like HDMI).
        """
        devices = []
        try:
            import pyaudio
            pa = pyaudio.PyAudio()
            try:
                for i in range(pa.get_device_count()):
                    info = pa.get_device_info_by_index(i)
                    if int(info.get('maxInputChannels', 0)) > 0:
                        devices.append({'index': i, 'name': str(info.get('name', f'device {i}'))})
            finally:
                pa.terminate()
        except Exception as e:
            logger.warning("list_microphones failed: %s", e)
        return devices

    def _coerce_device(self, device) -> Optional[int]:
        """Turn a stored preference (device name or index string) into a PortAudio
        index. Empty/None falls back to the env-configured default."""
        if device is None:
            return self.mic_device_index
        value = str(device).strip()
        if not value:
            return self.mic_device_index
        if value.lstrip('-').isdigit():
            return int(value)
        try:
            import speech_recognition as sr
            for i, name in enumerate(sr.Microphone.list_microphone_names()):
                if value.lower() in name.lower():
                    return i
        except Exception as e:
            logger.warning("Mic device resolution failed: %s", e)
        logger.warning("Mic device %r not found; using default", device)
        return self.mic_device_index

    def record_and_recognize_once(self, language: Optional[str] = None, timeout_seconds: int = 5, phrase_time_limit: int = 7, device=None):
        """
        Record from the selected microphone for up to timeout_seconds and return recognized text.
        Uses Google Speech Recognition (requires internet on the server).

        Args:
            device: optional capture device (name or index) overriding the default;
                    typically the user's choice saved in preferences.

        Returns:
            tuple: (text: str or None, error: str or None)
        """
        if not self.speech_recognition_available:
            return None, "Speech recognition not available"
        lang = language or self.language
        try:
            import speech_recognition as sr
            microphone = sr.Microphone(device_index=self._coerce_device(device))
            with microphone as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = self.recognizer.listen(source, timeout=timeout_seconds, phrase_time_limit=phrase_time_limit)
            text = self.recognizer.recognize_google(audio, language=lang)
            return (text or "").strip() or None, None
        except sr.WaitTimeoutError:
            return None, "No speech heard (timeout)"
        except sr.UnknownValueError:
            return None, "Speech not understood"
        except sr.RequestError as e:
            return None, f"Recognition service error: {e}"
        except OSError as e:
            msg = str(e).lower()
            if "portaudio" in msg or "invalid input device" in msg or "9996" in msg:
                return None, "Microfon indisponibil (verifică arecord -l și ~/.asoundrc)"
            logger.exception("record_and_recognize_once failed")
            return None, str(e)
        except AttributeError as e:
            # SpeechRecognition's Microphone.__enter__ swallows a failed
            # PyAudio open() and leaves stream=None, so cleanup raises
            # "'NoneType' object has no attribute 'close'". That really means
            # the capture device couldn't be opened (wrong device / no access).
            if "nonetype" in str(e).lower():
                logger.warning("Microphone open failed (stream is None): %s", e)
                return None, "Microfon indisponibil — nu s-a putut deschide dispozitivul (vezi VOICE_MIC_DEVICE_INDEX/NAME și grupul 'audio')"
            logger.exception("record_and_recognize_once failed")
            return None, str(e)
        except Exception as e:
            logger.exception("record_and_recognize_once failed")
            return None, str(e)

# Global voice service instance
voice_service = VoiceService()