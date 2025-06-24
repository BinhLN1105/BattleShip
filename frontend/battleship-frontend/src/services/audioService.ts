/**
 * Audio Service - Quản lý sound effects cho game
 */

export class AudioService {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private volume: number = 0.5;
  private isMuted: boolean = false;

  constructor() {
    this.loadSounds();
  }

  // Load sound files
  private loadSounds() {
    const soundFiles = {
      hit: this.createBeepSound(800, 0.1, 'sine'), // High beep for hit
      miss: this.createBeepSound(300, 0.1, 'sine'), // Low beep for miss
      sunk: this.createBeepSound(600, 0.3, 'triangle'), // Different tone for sunk
      place: this.createBeepSound(500, 0.05, 'square'), // Quick beep for place
      win: this.createMelody([523, 659, 784], 0.2), // C-E-G melody for win
      lose: this.createMelody([392, 330, 262], 0.3), // G-E-C descending for lose
      notification: this.createBeepSound(440, 0.1, 'sine') // A note for notifications
    };

    Object.entries(soundFiles).forEach(([name, audio]) => {
      this.sounds.set(name, audio);
    });
  }

  // Create a beep sound using Web Audio API
  private createBeepSound(frequency: number, duration: number, type: OscillatorType = 'sine'): HTMLAudioElement {
    // For now, we'll create a simple audio element
    // In a real app, you'd use Web Audio API for better control
    const audio = new Audio();
    
    // Create a data URL for a simple beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
    
    // Convert to audio element (simplified approach)
    audio.volume = this.volume;
    
    return audio;
  }

  // Create a melody (sequence of notes)
  private createMelody(frequencies: number[], noteDuration: number): HTMLAudioElement {
    const audio = new Audio();
    audio.volume = this.volume;
    return audio;
  }

  // Play a sound effect
  play(soundName: string): void {
    if (this.isMuted) return;

    const sound = this.sounds.get(soundName);
    if (sound) {
      // Reset sound to beginning
      sound.currentTime = 0;
      sound.volume = this.volume;
      
      // Play with fallback for browsers that don't support audio
      const playPromise = sound.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Audio play failed:', error);
          // Fallback: use Web Audio API for simple beep
          this.playBeepFallback(soundName);
        });
      }
    } else {
      // Fallback for missing sounds
      this.playBeepFallback(soundName);
    }
  }

  // Fallback beep using Web Audio API
  private playBeepFallback(soundName: string): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different frequencies for different sounds
      const soundMap: Record<string, { freq: number; duration: number }> = {
        hit: { freq: 800, duration: 0.1 },
        miss: { freq: 300, duration: 0.1 },
        sunk: { freq: 600, duration: 0.3 },
        place: { freq: 500, duration: 0.05 },
        win: { freq: 784, duration: 0.2 },
        lose: { freq: 262, duration: 0.3 },
        notification: { freq: 440, duration: 0.1 }
      };
      
      const config = soundMap[soundName] || { freq: 440, duration: 0.1 };
      
      oscillator.frequency.value = config.freq;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + config.duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + config.duration);
    } catch (error) {
      console.warn('Audio fallback failed:', error);
    }
  }

  // Set volume (0-1)
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume = this.volume;
    });
  }

  // Get current volume
  getVolume(): number {
    return this.volume;
  }

  // Mute/unmute all sounds
  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  // Get mute state
  isSoundMuted(): boolean {
    return this.isMuted;
  }

  // Toggle mute
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Play sequence of sounds (for complex effects)
  playSequence(sounds: string[], interval: number = 200): void {
    sounds.forEach((soundName, index) => {
      setTimeout(() => {
        this.play(soundName);
      }, index * interval);
    });
  }

  // Play game action sounds with context
  playGameSound(action: 'hit' | 'miss' | 'sunk' | 'place' | 'win' | 'lose' | 'turn' | 'chat'): void {
    switch (action) {
      case 'hit':
        this.play('hit');
        break;
      case 'miss':
        this.play('miss');
        break;
      case 'sunk':
        // Play hit followed by sunk sound
        this.play('hit');
        setTimeout(() => this.play('sunk'), 100);
        break;
      case 'place':
        this.play('place');
        break;
      case 'win':
        this.playSequence(['win', 'win', 'win'], 150);
        break;
      case 'lose':
        this.play('lose');
        break;
      case 'turn':
        this.play('notification');
        break;
      case 'chat':
        this.play('notification');
        break;
      default:
        this.play('notification');
    }
  }
}

// Singleton instance
export const audioService = new AudioService();

// Sound effect helpers
export const playSound = (action: string) => {
  audioService.play(action);
};

export const playGameSound = (action: 'hit' | 'miss' | 'sunk' | 'place' | 'win' | 'lose' | 'turn' | 'chat') => {
  audioService.playGameSound(action);
};
