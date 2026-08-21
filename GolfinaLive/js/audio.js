export class AudioManager {
  constructor(audioFiles) {
    this.audioFiles = audioFiles;
    this.audioElements = {};
    this.currentAudio = null;
    this.preloadAll();
  }
  
  preloadAll() {
    for (const [key, path] of Object.entries(this.audioFiles)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.audioElements[key] = audio;
    }
  }
  
  async play(key) {
    if (!this.audioElements[key]) return;
    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }
      this.currentAudio = this.audioElements[key];
      this.currentAudio.currentTime = 0;
      await this.currentAudio.play();
    } catch (error) {
      console.warn('Error reproduciendo audio:', error);
    }
  }
  
  stopAll() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }
}