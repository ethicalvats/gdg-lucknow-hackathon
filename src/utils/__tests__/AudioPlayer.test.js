import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioPlayer } from '../AudioPlayer';

// Mock Web Audio Context
class MockAudioContext {
  constructor(options) {
    this.sampleRate = options?.sampleRate || 24000;
    this.currentTime = 0.5;
    this.state = 'suspended';
    this.destination = {};
  }

  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });

  close = vi.fn().mockImplementation(async () => {
    this.state = 'closed';
  });

  createBuffer = vi.fn().mockImplementation((channels, length, sampleRate) => {
    return {
      numberOfChannels: channels,
      length: length,
      sampleRate: sampleRate,
      duration: length / sampleRate,
      copyToChannel: vi.fn(),
    };
  });

  createBufferSource = vi.fn().mockImplementation(() => {
    return {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    };
  });
}

describe('AudioPlayer Utility', () => {
  let originalAudioContext;
  let originalWebkitAudioContext;

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    originalWebkitAudioContext = window.webkitAudioContext;
    window.AudioContext = MockAudioContext;
    window.webkitAudioContext = undefined;
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.webkitAudioContext = originalWebkitAudioContext;
    vi.restoreAllMocks();
  });

  it('should initialize with correct default state', () => {
    const player = new AudioPlayer();
    expect(player.audioContext).toBeNull();
    expect(player.nextPlayTime).toBe(0);
    expect(player.activeSources).toEqual([]);
  });

  it('should create and resume AudioContext on init', () => {
    const player = new AudioPlayer();
    player.init();
    expect(player.audioContext).toBeInstanceOf(MockAudioContext);
    expect(player.audioContext.state).toBe('running');
    expect(player.audioContext.resume).toHaveBeenCalled();
  });

  it('should decode base64, align bytes, construct buffer, and schedule playChunk', () => {
    const player = new AudioPlayer();
    
    // Generate valid 16-bit PCM base64 string
    // "AAAA" represents 3 null bytes which align to even 2 bytes length after decoding
    const base64Data = 'AAAA'; 
    player.playChunk(base64Data);

    expect(player.audioContext.createBuffer).toHaveBeenCalled();
    expect(player.audioContext.createBufferSource).toHaveBeenCalled();
    expect(player.activeSources.length).toBe(1);
  });

  it('should stop all scheduled buffers and reset state on stop()', () => {
    const player = new AudioPlayer();
    player.init();
    
    const mockSource1 = { stop: vi.fn(), connect: vi.fn() };
    const mockSource2 = { stop: vi.fn(), connect: vi.fn() };
    
    player.activeSources = [mockSource1, mockSource2];
    player.stop();

    expect(mockSource1.stop).toHaveBeenCalled();
    expect(mockSource2.stop).toHaveBeenCalled();
    expect(player.activeSources).toEqual([]);
    expect(player.nextPlayTime).toBe(player.audioContext.currentTime);
  });

  it('should close AudioContext on close()', () => {
    const player = new AudioPlayer();
    player.init();
    const closeSpy = vi.spyOn(player.audioContext, 'close');
    player.close();

    expect(closeSpy).toHaveBeenCalled();
    expect(player.audioContext).toBeNull();
  });
});
