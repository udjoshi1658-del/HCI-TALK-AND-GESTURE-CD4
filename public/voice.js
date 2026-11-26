export class VoiceController {
  constructor({ onStatus, onInterim, onFinal, onError } = {}) {
    const noop = () => {};
    this.onStatus = onStatus || noop;
    this.onInterim = onInterim || noop;
    this.onFinal = onFinal || noop;
    this.onError = onError || noop;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    this.supported = Boolean(SpeechRecognition);
    this.wantListening = false;

    if (!this.supported) {
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = "en-US";
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this._attachEventHandlers();
  }

  start() {
    if (!this.supported) {
      this.onStatus("unsupported");
      this.onError(
        "Speech recognition is not supported in this browser. Please use Google Chrome.",
        true
      );
      return;
    }
    this.wantListening = true;
    this._safeStart();
  }

  stop() {
    this.wantListening = false;
    if (this.supported) {
      this.recognition.stop();
    }
  }

  _safeStart() {
    try {
      this.recognition.start();
    } catch (err) {
      console.warn("recognition.start() ignored:", err.message);
    }
  }

  _attachEventHandlers() {
    this.recognition.onstart = () => {
      this.onStatus("listening");
    };

    this.recognition.onresult = (event) => {
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const best = result[0];

        if (result.isFinal) {
          this.onFinal(best.transcript.trim(), best.confidence);
          interimText = "";
        } else {
          interimText += best.transcript;
        }
      }

      if (interimText) {
        this.onInterim(interimText.trim());
      }
    };

    this.recognition.onerror = (event) => {
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          this.wantListening = false;
          this.onStatus("error");
          this.onError(
            "Microphone permission was denied. Click the lock icon in Chrome's address bar, set Microphone to Allow, then reload the page.",
            true
          );
          break;

        case "audio-capture":
          this.wantListening = false;
          this.onStatus("error");
          this.onError(
            "No microphone was found. Check that one is plugged in and enabled in Windows settings.",
            true
          );
          break;

        case "network":
          this.wantListening = false;
          this.onStatus("error");
          this.onError(
            "Network error. Chrome's speech recognition needs an internet connection.",
            true
          );
          break;

        case "no-speech":
          this.onError("No speech detected yet. Try speaking again.", false);
          break;

        case "aborted":
          break;

        default:
          this.onError(`Speech recognition error: ${event.error}`, false);
      }
    };

    this.recognition.onend = () => {
      if (this.wantListening) {
        setTimeout(() => {
          if (this.wantListening) this._safeStart();
        }, 300);
      } else {
        this.onStatus("stopped");
      }
    };
  }
}