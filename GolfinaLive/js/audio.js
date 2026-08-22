export class AudioManager {
  constructor(audioFiles) {
    this.audioFiles = audioFiles;
    this.audioElements = {};
    this.currentAudio = null; // audio de un solo disparo
    this.loopAudio = null; // audio de fondo en bucle
    this.preloadAll();
  }
  
  preloadAll() {
    for (const [key, path] of Object.entries(this.audioFiles)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      if (key === 'estadio_completo') {
        audio.loop = true; // activar bucle para este audio
      }
      this.audioElements[key] = audio;
    }
  }
  
  // Reproduce un audio de un solo disparo
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
  
  // Inicia el audio de fondo en bucle (si no está ya sonando)
  playLoop(key) {
    if (!this.audioElements[key]) return;
    if (this.loopAudio && !this.loopAudio.paused) {
      // Ya está sonando el bucle, no hacer nada
      return;
    }
    this.loopAudio = this.audioElements[key];
    this.loopAudio.loop = true;
    this.loopAudio.currentTime = 0;
    this.loopAudio.play().catch(e => console.warn('Error iniciando bucle:', e));
  }
  
  // Detiene el audio de fondo
  stopLoop() {
    if (this.loopAudio) {
      this.loopAudio.pause();
      this.loopAudio.currentTime = 0;
      this.loopAudio = null;
    }
  }
  
  // Detiene todo (tanto efectos como bucle)
  stopAll() {
    this.stopLoop();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }
}