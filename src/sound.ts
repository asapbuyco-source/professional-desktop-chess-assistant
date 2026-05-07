let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.1) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
  }
}

export function playMoveSound() {
  playTone(440, 0.1, 'sine', 0.08);
}

export function playCaptureSound() {
  playTone(330, 0.15, 'square', 0.1);
}

export function playCheckSound() {
  playTone(880, 0.2, 'sawtooth', 0.12);
  setTimeout(() => playTone(660, 0.15, 'sine', 0.08), 100);
}

export function playPromotionSound() {
  playTone(523, 0.1, 'sine', 0.1);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.1), 80);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.1), 160);
}

export function playGameOverSound() {
  playTone(392, 0.3, 'sine', 0.12);
  setTimeout(() => playTone(330, 0.3, 'sine', 0.1), 200);
  setTimeout(() => playTone(262, 0.4, 'sine', 0.08), 400);
}

export function initAudio() {
  try {
    getAudioContext();
  } catch {
  }
}