import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioRecorder } from '../AudioRecorder';

// Mock getUserMedia stream
const mockTrack = {
  stop: vi.fn(),
};

const mockStream = {
  getTracks: () => [mockTrack],
};

// Mock AudioContext
class MockRecorderAudioContext {
  constructor(options) {
    this.sampleRate = options?.sampleRate || 16000;
    this.state = 'running';
    this.destination = {};
  }

  createMediaStreamSource = vi.fn().mockImplementation(() => {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  createScriptProcessor = vi.fn().mockImplementation(() => {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
  });

  close = vi.fn().mockImplementation(async () => {
    this.state = 'closed';
  });
}

describe('AudioRecorder Utility', () => {
  let originalAudioContext;
  let originalGetUserMedia;

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    window.AudioContext = MockRecorderAudioContext;

    // Define navigator.mediaDevices if not present
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {},
        writable: true,
        configurable: true,
      });
    }

    originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    navigator.mediaDevices.getUserMedia = originalGetUserMedia;
    vi.restoreAllMocks();
  });

  it('should initialize with correct default state', () => {
    const callback = vi.fn();
    const recorder = new AudioRecorder(callback);
    expect(recorder.onAudioChunk).toBe(callback);
    expect(recorder.audioContext).toBeNull();
    expect(recorder.stream).toBeNull();
    expect(recorder.processor).toBeNull();
  });

  it('should request microphone access and start capture on start()', async () => {
    const callback = vi.fn();
    const recorder = new AudioRecorder(callback);
    
    await recorder.start();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    expect(recorder.stream).toBe(mockStream);
    expect(recorder.audioContext).toBeInstanceOf(MockRecorderAudioContext);
    expect(recorder.audioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    expect(recorder.audioContext.createScriptProcessor).toHaveBeenCalledWith(2048, 1, 1);
  });

  it('should convert Float32 sound waves to 16-bit PCM base64 inside onaudioprocess callback', async () => {
    const callback = vi.fn();
    const recorder = new AudioRecorder(callback);
    
    await recorder.start();

    // Trigger audio process event
    const audioProcessEvent = {
      inputBuffer: {
        getChannelData: vi.fn().mockReturnValue(new Float32Array([0.5, -0.5, 0])),
      },
    };

    recorder.processor.onaudioprocess(audioProcessEvent);

    expect(callback).toHaveBeenCalled();
    const base64Chunk = callback.mock.calls[0][0];
    expect(typeof base64Chunk).toBe('string');
    expect(base64Chunk.length).toBeGreaterThan(0);
  });

  it('should stop capture, close contexts and clean up resources on stop()', async () => {
    const callback = vi.fn();
    const recorder = new AudioRecorder(callback);
    
    await recorder.start();
    const closeSpy = vi.spyOn(recorder.audioContext, 'close');
    const trackStopSpy = vi.spyOn(mockTrack, 'stop');

    recorder.stop();

    expect(closeSpy).toHaveBeenCalled();
    expect(trackStopSpy).toHaveBeenCalled();
    expect(recorder.audioContext).toBeNull();
    expect(recorder.stream).toBeNull();
    expect(recorder.processor).toBeNull();
    expect(recorder.source).toBeNull();
  });
});
