"""Unit tests for VoiceService (src/voice/service.py).

We construct fresh instances and drive the pure logic (settings clamping,
availability reporting, guard clauses, TTS) without real microphone/SR hardware.
"""
from voice.service import VoiceService


def _service():
    # A bare instance regardless of whether SR/TTS libs are present on the host.
    svc = VoiceService()
    return svc


def test_update_settings_sets_language():
    svc = _service()
    svc.update_settings(language='en-US')
    assert svc.language == 'en-US'


def test_update_settings_clamps_sensitivity():
    svc = _service()
    svc.update_settings(sensitivity=5.0)
    assert svc.sensitivity == 1.0
    svc.update_settings(sensitivity=-2.0)
    assert svc.sensitivity == 0.0


def test_update_settings_none_is_noop():
    svc = _service()
    before = (svc.language, svc.sensitivity)
    svc.update_settings()
    assert (svc.language, svc.sensitivity) == before


def test_is_available_shape():
    svc = _service()
    out = svc.is_available()
    assert set(out) == {'speech_recognition', 'text_to_speech', 'listening', 'language', 'sensitivity'}
    assert out['listening'] is False


def test_start_listening_blocked_when_sr_unavailable():
    svc = _service()
    svc.speech_recognition_available = False
    assert svc.start_listening(lambda text: None) is False


def test_start_listening_blocked_when_already_listening():
    svc = _service()
    svc.speech_recognition_available = True
    svc.is_listening = True
    assert svc.start_listening(lambda text: None) is False


def test_speak_text_unavailable_returns_false():
    svc = _service()
    svc.text_to_speech_available = False
    assert svc.speak_text('salut') is False


def test_speak_text_ok():
    svc = _service()
    svc.text_to_speech_available = True
    spoken = {}
    svc.tts_engine = type('E', (), {
        'say': lambda self, t: spoken.__setitem__('text', t),
        'runAndWait': lambda self: None,
    })()
    assert svc.speak_text('salut') is True
    assert spoken['text'] == 'salut'


def test_speak_text_engine_error_returns_false():
    svc = _service()
    svc.text_to_speech_available = True

    def boom(t):
        raise RuntimeError('engine crashed')

    svc.tts_engine = type('E', (), {'say': lambda self, t: boom(t), 'runAndWait': lambda self: None})()
    assert svc.speak_text('salut') is False


def test_record_and_recognize_once_unavailable():
    svc = _service()
    svc.speech_recognition_available = False
    text, error = svc.record_and_recognize_once()
    assert text is None
    assert 'not available' in error


def test_stop_listening_clears_flag():
    svc = _service()
    svc.is_listening = True
    svc.stop_listening()  # no thread started → join branch skipped
    assert svc.is_listening is False
