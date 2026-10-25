/**
 * Lightweight in-browser 16-bit PCM WAV audio recorder.
 * Zero external dependencies. Ensures maximum compatibility with Cloudflare Whisper v3 Turbo.
 */

export interface RecorderResult {
  blob: Blob;
  base64: string;
  hasSpeech: boolean;
  durationMs: number;
}

const SPEECH_START_RMS_THRESHOLD = 0.003;
const SPEECH_CONTINUE_RMS_THRESHOLD = 0.0018;
const SPEECH_START_MIN_DURATION_MS = 180;
const SPEECH_END_SILENCE_MS = 650;
export class WavRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private audioBuffers: Float32Array[] = [];
  private sampleRate = 16000; // Optimal 16kHz for Whisper v3 Turbo
  private isRecording = false;
  private volumeCallback: ((volume: number) => void) | null = null;
  private startTime = 0;
  private speechFramesCount = 0;
  private speechStartNotified = false;
  private speechCandidateDurationMs = 0;
  private totalFramesCount = 0;
  private silenceDurationMs = 0;
  private speechEndNotified = false;

  async start(
    onVolume?: (volume: number) => void,
    onSpeechEnd?: () => void,
    onSpeechStart?: () => void
  ): Promise<void> {
    this.volumeCallback = onVolume || null;
    this.audioBuffers = [];
    this.speechFramesCount = 0;
    this.speechStartNotified = false;
    this.speechCandidateDurationMs = 0;
    this.totalFramesCount = 0;
    this.silenceDurationMs = 0;
    this.speechEndNotified = false;
    this.startTime = Date.now();

    this.sampleRate = 16000;

    // 1. Hardware & Browser Level Constraints (Layer 1: AEC + HW Noise Suppression)
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: this.sampleRate,
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
      },
    });

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    // Adapt to true device sample rate (e.g., 44.1kHz or 48kHz on iOS Safari)
    if (this.audioContext.sampleRate) {
      this.sampleRate = this.audioContext.sampleRate;
    }

    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // 2. Audio DSP Filter Chain (Layer 2: Bandpass 85Hz - 7.5kHz + Noise Gate)
    // High-pass filter cuts low-frequency hum, air conditioner rumble, and table thumps (<85Hz)
    this.highPassFilter = this.audioContext.createBiquadFilter();
    this.highPassFilter.type = "highpass";
    this.highPassFilter.frequency.value = 85;
    this.highPassFilter.Q.value = 0.707;

    // Low-pass filter cuts high-frequency electrical hiss and coil whine (>7500Hz)
    this.lowPassFilter = this.audioContext.createBiquadFilter();
    this.lowPassFilter.type = "lowpass";
    this.lowPassFilter.frequency.value = 7500;
    this.lowPassFilter.Q.value = 0.707;

    // Processor Node
    this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const input = e.inputBuffer.getChannelData(0);

      // Compute frame RMS energy
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);
      this.totalFramesCount++;
      const frameDurationMs = (input.length / this.sampleRate) * 1000;

      if (rms > SPEECH_START_RMS_THRESHOLD) {
        this.speechFramesCount++;
        this.speechCandidateDurationMs += frameDurationMs;
        if (!this.speechStartNotified) {
          if (this.speechCandidateDurationMs >= SPEECH_START_MIN_DURATION_MS) {
            this.speechStartNotified = true;
            onSpeechStart?.();
          }
        }
      } else if (!this.speechStartNotified) {
        this.speechCandidateDurationMs = 0;
        this.speechFramesCount = 0;
      }

      if (this.speechStartNotified && rms > SPEECH_CONTINUE_RMS_THRESHOLD) {
        this.silenceDurationMs = 0;
      } else if (this.speechStartNotified) {
        this.silenceDurationMs += frameDurationMs;
        if (this.silenceDurationMs >= SPEECH_END_SILENCE_MS && !this.speechEndNotified) {
          this.speechEndNotified = true;
          onSpeechEnd?.();
        }
      }

      // Keep low-volume speech detail intact; browser noise suppression handles background noise.
      const filteredChunk = new Float32Array(input.length);
      filteredChunk.set(input);

      this.audioBuffers.push(filteredChunk);

      // Calculate smooth volume level (0 to 100)
      if (this.volumeCallback) {
        const volume = Math.min(100, Math.round(rms * 280));
        this.volumeCallback(volume);
      }
    };

    // Chain: Source -> HighPass -> LowPass -> Processor -> Destination
    this.source.connect(this.highPassFilter);
    this.highPassFilter.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.isRecording = true;
  }

  async stop(): Promise<RecorderResult> {
    this.isRecording = false;
    const durationMs = Date.now() - this.startTime;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.lowPassFilter) {
      this.lowPassFilter.disconnect();
      this.lowPassFilter = null;
    }
    if (this.highPassFilter) {
      this.highPassFilter.disconnect();
      this.highPassFilter = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Merge audio chunks
    const totalLength = this.audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const merged = this.mergeBuffers(this.audioBuffers, totalLength);

    const hasSpeech = this.speechFramesCount >= 2 && durationMs >= 300;

    // Encode to 16-bit PCM WAV
    const wavBlob = this.encodeWAV(merged, this.sampleRate);
    const base64 = await this.blobToBase64(wavBlob);

    return { blob: wavBlob, base64, hasSpeech, durationMs };
  }

  private encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 for mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    // Write PCM samples
    let index = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      index += 2;
    }

    return new Blob([view], { type: "audio/wav" });
  }

  private mergeBuffers(buffers: Float32Array[], totalLength: number): Float32Array {
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      merged.set(buffer, offset);
      offset += buffer.length;
    }
    return merged;
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
