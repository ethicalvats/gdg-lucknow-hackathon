export class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.nextPlayTime = 0;
    this.activeSources = [];
  }

  init() {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      // Gemini Live outputs 24kHz audio. Creating an AudioContext at 24000Hz
      // allows us to push samples directly without manual upsampling.
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.audioContext.currentTime;
    }
    
    // Resume context if suspended (common browser security policy)
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  playChunk(base64Data) {
    this.init();

    // Decode base64 to binary string
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert raw 16-bit PCM bytes (little-endian) to Int16Array
    const int16Data = new Int16Array(bytes.buffer);

    // Convert Int16Array to Float32Array [-1.0, 1.0] for Web Audio API
    const float32Data = new Float32Array(int16Data.length);
    for (let i = 0; i < int16Data.length; i++) {
      float32Data[i] = int16Data[i] / 32768.0;
    }

    // Create an AudioBuffer (mono, 24kHz)
    const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 24000);
    audioBuffer.copyToChannel(float32Data, 0);

    // Create a buffer source node
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Schedule playback sequentially
    const currentTime = this.audioContext.currentTime;
    const playTime = Math.max(this.nextPlayTime, currentTime);
    
    source.start(playTime);
    this.nextPlayTime = playTime + audioBuffer.duration;

    // Track active source nodes to allow interruption (stopping current speech)
    this.activeSources.push(source);
    source.onended = () => {
      this.activeSources = this.activeSources.filter((s) => s !== source);
    };
  }

  stop() {
    // Immediately stop all scheduled and playing audio buffers (interruption)
    this.activeSources.forEach((source) => {
      try {
        source.stop();
      } catch (err) {
        // Source might have already finished playing
      }
    });
    this.activeSources = [];
    
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  close() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
