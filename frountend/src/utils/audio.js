// Browser Web Audio API Synthesizer
// Generates chiptune audio signals on-the-fly, completely offline.

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a synthesized beep.
 * @param {number} freq Start frequency in Hz
 * @param {number} duration Duration in seconds
 * @param {string} type Oscillator wave type ('sine', 'square', 'sawtooth', 'triangle')
 * @param {number} endFreq Optional end frequency for pitch sweeps
 * @param {number} volume Volume multiplier (0.0 to 1.0)
 */
function playTone(freq, duration, type = 'sine', endFreq = null, volume = 0.1) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    if (endFreq) {
      // Frequency sweep (glide)
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    }

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    // Smooth volume decay to prevent click sound
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn("Web Audio play failed (user interaction might be required):", e);
  }
}

export const playMove = () => {
  // Rising slide sweep: representing bus movement acceleration
  playTone(260, 0.18, 'triangle', 380, 0.12);
};

export const playPickup = () => {
  // Double high-pitch chime (C5 -> E5)
  const ctx = getAudioContext();
  const now = ctx.currentTime;
  
  // First tone: C5 (523.25 Hz)
  playTone(523.25, 0.08, 'sine', null, 0.15);
  
  // Second tone: E5 (659.25 Hz) slightly delayed
  setTimeout(() => {
    playTone(659.25, 0.16, 'sine', null, 0.15);
  }, 80);
};

export const playSuccess = () => {
  // Bright arpeggio: C5 -> E5 -> G5 -> C6
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, idx) => {
    setTimeout(() => {
      playTone(freq, 0.15, 'sine', null, 0.15);
    }, idx * 60);
  });
};

export const playError = () => {
  // Low-frequency warning buzz: flat sawtooth wave
  playTone(150, 0.28, 'sawtooth', 110, 0.15);
};

export const playBreakdown = () => {
  // Oscillating alarm siren (high-low-high-low)
  const ctx = getAudioContext();
  const duration = 0.15;
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const freq = i % 2 === 0 ? 440 : 330;
      playTone(freq, duration, 'square', null, 0.08);
    }, i * 150);
  }
};
