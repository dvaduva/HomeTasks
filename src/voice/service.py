"""
Voice service module for HomeTasks.
Handles speech recognition and text-to-speech functionality.
"""

import logging
import threading
import queue
import time
from typing import Optional, Callable

logger = logging.getLogger(__name__)

class VoiceService:
    """Service for handling voice commands and speech synthesis."""
    
    def __init__(self):
        self.is_listening = False
        self.speech_recognition_available = False
        self.text_to_speech_available = False
        self.callback: Optional[Callable[[str], None]] = None
        self.audio_queue = queue.Queue()
        
        # Try to initialize speech recognition
        try:
            import speech_recognition as sr
            self.recognizer = sr.Recognizer()
            self.microphone = sr.Microphone()
            self.speech_recognition_available = True
            logger.info("Speech recognition initialized successfully")
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
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
                logger.info("Microphone calibrated for ambient noise")
                
                while self.is_listening:
                    try:
                        logger.debug("Listening for audio...")
                        audio = self.recognizer.listen(source, timeout=1, phrase_time_limit=5)
                        logger.debug("Audio captured, processing...")
                        
                        # Use Google Speech Recognition
                        text = self.recognizer.recognize_google(audio, language="ro-RO")
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
            'listening': self.is_listening
        }

# Global voice service instance
voice_service = VoiceService()