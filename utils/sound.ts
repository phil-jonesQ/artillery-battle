// Simple Web Audio API Synthesizer for Retro Sound Effects

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

const createOscillator = (type: OscillatorType, freq: number, duration: number, vol: number = 0.1) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
};

export const playShootSound = () => {
  // Laser pew-pew sound
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);

  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
};

export const playMissileWhistle = () => {
  // Falling whistle tone (Doppler effect)
  // Returns a stop function to cut the sound when the shell hits
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  // Start high, drop low over a longer duration
  const now = audioCtx.currentTime;
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(100, now + 4);

  // Fade in
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.1);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();

  // Return a closure to stop the sound
  return () => {
     // Quick fade out
     const stopTime = audioCtx.currentTime;
     gain.gain.cancelScheduledValues(stopTime);
     gain.gain.setValueAtTime(gain.gain.value, stopTime);
     gain.gain.linearRampToValueAtTime(0, stopTime + 0.1);
     osc.stop(stopTime + 0.1);
  };
};

export const playExplosionSound = () => {
  // White noise burst for explosion
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  // Filter to make it sound low and rumbly
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1000;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start();
};

export const playImpactSound = () => {
  // Short thump
  createOscillator('square', 150, 0.1, 0.2);
};

export const playTurnChangeSound = () => {
  // High ping
  createOscillator('sine', 880, 0.1, 0.05);
};