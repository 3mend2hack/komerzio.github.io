import { supabase } from './supabase.js';

export class UIManager {
  constructor(config) {
    this.field = config.field;
    this.canvasWidth = config.canvasWidth;
    this.canvasHeight = config.canvasHeight;
    this.onFieldChange = config.onFieldChange || (() => {});
    this.onImageSizeChange = config.onImageSizeChange || (() => {});
    this.onOffsetChange = config.onOffsetChange || (() => {});
    this.onControlAction = config.onControlAction || (() => {});
    this.onAudioAction = config.onAudioAction || (() => {});
    this.onBallSpeedChange = config.onBallSpeedChange || (() => {});
    this.onGoalSizeChange = config.onGoalSizeChange || (() => {});
    this.onGoalTargetChange = config.onGoalTargetChange || (() => {});

    this.playerNames = { red: 'Rojo', blue: 'Azul' };
    this.playerImages = {
      red: 'https://via.placeholder.com/150/ff4444/ffffff?text=Rojo',
      blue: 'https://via.placeholder.com/150/4444ff/ffffff?text=Azul'
    };
    this.goalTarget = 5;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.loadSettings();
    await this.loadImagesFromStorage(); // Siempre carga desde Supabase
    this.applySettings();
    this.updatePlayerNamesDisplay();
    this.updatePlayerImagesDisplay();
    this.updateGoalTargetDisplay();
    this.updateGoalTargetInput();
  }

  bindEvents() {
    // Sliders de dimensiones
    document.getElementById('field-width').addEventListener('input', () => this.updateFieldSizeFromInputs());
    document.getElementById('field-height').addEventListener('input', () => this.updateFieldSizeFromInputs());
    document.getElementById('image-size').addEventListener('input', () => this.updateImageSizeFromInput());
    document.getElementById('ball-speed').addEventListener('input', () => this.updateBallSpeedFromInput());
    document.getElementById('goal-size').addEventListener('input', () => this.updateGoalSizeFromInput());
    document.getElementById('goal-target-input').addEventListener('change', () => this.updateGoalTargetFromInput());

    // Botones direccionales
    document.getElementById('move-up').addEventListener('click', () => this.moveField(0, -10));
    document.getElementById('move-down').addEventListener('click', () => this.moveField(0, 10));
    document.getElementById('move-left').addEventListener('click', () => this.moveField(-10, 0));
    document.getElementById('move-right').addEventListener('click', () => this.moveField(10, 0));

    // Botones de control
    document.getElementById('btn-start').addEventListener('click', () => this.onControlAction('start'));
    document.getElementById('btn-pause').addEventListener('click', () => this.onControlAction('pause'));
    document.getElementById('btn-resume').addEventListener('click', () => this.onControlAction('resume'));
    document.getElementById('btn-reset').addEventListener('click', () => this.onControlAction('reset'));

    // Botones de audio
    document.querySelectorAll('.audio-btn').forEach(btn => {
      btn.addEventListener('click', () => this.onAudioAction(btn.dataset.audio));
    });

    // Toggle del panel de ajustes de campo
    document.getElementById('toggle-settings').addEventListener('click', () => {
      const panel = document.getElementById('settings-panel');
      const toggle = document.getElementById('toggle-settings');
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      panel.classList.toggle('open');
    });

    // Modal de nombres
    document.getElementById('btn-player-names').addEventListener('click', () => this.openNamesModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeNamesModal());
    document.getElementById('btn-save-names').addEventListener('click', () => this.savePlayerNames());

    // Subida de imágenes
    document.getElementById('input-file-red').addEventListener('change', (e) => this.handleImageUpload(e, 'red'));
    document.getElementById('input-file-blue').addEventListener('change', (e) => this.handleImageUpload(e, 'blue'));

    // Eliminar imágenes
    document.getElementById('btn-delete-red').addEventListener('click', () => this.deleteImage('red'));
    document.getElementById('btn-delete-blue').addEventListener('click', () => this.deleteImage('blue'));
  }

  openNamesModal() {
    document.getElementById('input-name-red').value = this.playerNames.red;
    document.getElementById('input-name-blue').value = this.playerNames.blue;
    document.getElementById('player-image-red-preview').src = this.playerImages.red;
    document.getElementById('player-image-blue-preview').src = this.playerImages.blue;
    document.getElementById('player-name-modal').classList.add('open');
  }

  closeNamesModal() {
    document.getElementById('player-name-modal').classList.remove('open');
  }

  savePlayerNames() {
    const redName = document.getElementById('input-name-red').value.trim() || 'Rojo';
    const blueName = document.getElementById('input-name-blue').value.trim() || 'Azul';
    this.playerNames.red = redName;
    this.playerNames.blue = blueName;
    this.updatePlayerNamesDisplay();
    this.saveSettings();
    this.closeNamesModal();
  }

  async compressImage(file, maxSize = 300, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else if (height >= width && height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('No se pudo comprimir la imagen'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Error al cargar la imagen para comprimir'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  async loadImagesFromStorage() {
    const bucketName = 'jugadores';

    this.playerImages.red = `https://qddfdisbnwnnlvkrnckd.supabase.co/storage/v1/object/public/${bucketName}/red/1787368290429.jpg`;
    this.playerImages.blue = `https://qddfdisbnwnnlvkrnckd.supabase.co/storage/v1/object/public/${bucketName}/blue/1787368514576.jpg`;

    this.updatePlayerImagesDisplay();
  }

  async handleImageUpload(event, team) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const compressedBlob = await this.compressImage(file, 300, 0.8);
      const fileExt = 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const bucketName = 'jugadores';

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(`${team}/${fileName}`, compressedBlob, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(`${team}/${fileName}`);

      const publicUrl = publicUrlData.publicUrl;

      this.playerImages[team] = publicUrl;
      this.updatePlayerImagesDisplay();
      this.saveSettings();

      if (team === 'red') {
        document.getElementById('player-image-red-preview').src = publicUrl;
      } else {
        document.getElementById('player-image-blue-preview').src = publicUrl;
      }

      console.log(`Imagen de ${team} subida correctamente:`, publicUrl);
    } catch (error) {
      console.error('Error subiendo imagen:', error);
      alert('Error al subir la imagen. Revisa la consola.');
    }
  }

  async deleteImage(team) {
    const currentUrl = this.playerImages[team];
    if (!currentUrl || currentUrl.startsWith('https://via.placeholder.com')) {
      alert('No hay imagen personalizada para eliminar.');
      return;
    }

    try {
      const bucketName = 'jugadores';
      const urlParts = currentUrl.split('/');
      const filePath = `${team}/${urlParts[urlParts.length - 1]}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) throw error;

      const placeholder = team === 'red'
        ? 'https://via.placeholder.com/150/ff4444/ffffff?text=Rojo'
        : 'https://via.placeholder.com/150/4444ff/ffffff?text=Azul';

      this.playerImages[team] = placeholder;
      this.updatePlayerImagesDisplay();
      this.saveSettings();

      if (team === 'red') {
        document.getElementById('player-image-red-preview').src = placeholder;
      } else {
        document.getElementById('player-image-blue-preview').src = placeholder;
      }

      console.log(`Imagen de ${team} eliminada correctamente.`);
    } catch (error) {
      console.error('Error eliminando imagen:', error);
      alert('Error al eliminar la imagen. Revisa la consola.');
    }
  }

  updatePlayerNamesDisplay() {
    document.getElementById('player-name-red').textContent = this.playerNames.red;
    document.getElementById('player-name-blue').textContent = this.playerNames.blue;
  }

  updatePlayerImagesDisplay() {
    document.getElementById('player-image-red').querySelector('img').src = this.playerImages.red;
    document.getElementById('player-image-blue').querySelector('img').src = this.playerImages.blue;
  }

  updateGoalTargetDisplay() {
    document.getElementById('goal-target').textContent = this.goalTarget;
  }

  updateGoalTargetInput() {
    document.getElementById('goal-target-input').value = this.goalTarget;
  }

  loadSettings() {
    const saved = localStorage.getItem('football-settings-horizontal');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        document.getElementById('field-width').value = settings.fieldWidth;
        document.getElementById('field-height').value = settings.fieldHeight;
        document.getElementById('image-size').value = settings.imageSize;
        document.getElementById('ball-speed').value = settings.ballSpeed || 200;
        document.getElementById('goal-size').value = settings.goalSize || 0.4;
        document.getElementById('goal-target-input').value = settings.goalTarget || 5;
        this.field.width = settings.fieldWidth;
        this.field.height = settings.fieldHeight;
        this.field.offsetX = settings.offsetX;
        this.field.offsetY = settings.offsetY;
        this.field.goalMouthRatio = settings.goalSize || 0.4;
        this.goalTarget = settings.goalTarget || 5;
        if (settings.playerNames) {
          this.playerNames.red = settings.playerNames.red || 'Rojo';
          this.playerNames.blue = settings.playerNames.blue || 'Azul';
        }
        // No cargamos playerImages desde localStorage para evitar conflictos
      } catch (e) {
        console.warn('Error cargando settings:', e);
      }
    }
  }

  applySettings() {
    this.field.width = Number(document.getElementById('field-width').value);
    this.field.height = Number(document.getElementById('field-height').value);
    this.field.offsetX = Math.max(0, Math.min(this.field.offsetX, Math.max(0, this.canvasWidth - this.field.width)));
    this.field.offsetY = Math.max(0, Math.min(this.field.offsetY, Math.max(0, this.canvasHeight - this.field.height)));
    this.field.goalMouthRatio = Number(document.getElementById('goal-size').value);
    this.goalTarget = Number(document.getElementById('goal-target-input').value);
    this.updateImageSizeFromInput();
    this.updateBallSpeedFromInput();
    this.onFieldChange();
    this.onOffsetChange();
    this.onGoalSizeChange(this.field.goalMouthRatio);
    this.onBallSpeedChange(Number(document.getElementById('ball-speed').value));
    this.onGoalTargetChange(this.goalTarget);
  }

  updateFieldSizeFromInputs() {
    this.field.width = Number(document.getElementById('field-width').value);
    this.field.height = Number(document.getElementById('field-height').value);
    this.field.offsetX = Math.max(0, Math.min(this.field.offsetX, Math.max(0, this.canvasWidth - this.field.width)));
    this.field.offsetY = Math.max(0, Math.min(this.field.offsetY, Math.max(0, this.canvasHeight - this.field.height)));
    this.onFieldChange();
    this.onOffsetChange();
    this.saveSettings();
  }

  updateImageSizeFromInput() {
    const size = Number(document.getElementById('image-size').value);
    document.querySelectorAll('.player-image').forEach(el => {
      el.style.width = size + 'px';
      el.style.height = size + 'px';
    });
    this.onImageSizeChange(size);
    this.saveSettings();
  }

  updateBallSpeedFromInput() {
    const speed = Number(document.getElementById('ball-speed').value);
    this.onBallSpeedChange(speed);
    this.saveSettings();
  }

  updateGoalSizeFromInput() {
    const ratio = Number(document.getElementById('goal-size').value);
    this.field.goalMouthRatio = ratio;
    this.onGoalSizeChange(ratio);
    this.saveSettings();
  }

  updateGoalTargetFromInput() {
    this.goalTarget = Number(document.getElementById('goal-target-input').value);
    this.updateGoalTargetDisplay();
    this.onGoalTargetChange(this.goalTarget);
    this.saveSettings();
  }

  moveField(dx, dy) {
    const maxOffsetX = Math.max(0, this.canvasWidth - this.field.width);
    const maxOffsetY = Math.max(0, this.canvasHeight - this.field.height);
    this.field.offsetX = Math.max(0, Math.min(this.field.offsetX + dx, maxOffsetX));
    this.field.offsetY = Math.max(0, Math.min(this.field.offsetY + dy, maxOffsetY));
    this.onOffsetChange();
    this.saveSettings();
  }

  saveSettings() {
    const settings = {
      fieldWidth: this.field.width,
      fieldHeight: this.field.height,
      offsetX: this.field.offsetX,
      offsetY: this.field.offsetY,
      imageSize: document.getElementById('image-size').value,
      ballSpeed: document.getElementById('ball-speed').value,
      goalSize: document.getElementById('goal-size').value,
      goalTarget: this.goalTarget,
      playerNames: {
        red: this.playerNames.red,
        blue: this.playerNames.blue
      }
      // Nota: no guardamos playerImages para que siempre se carguen desde Supabase
    };
    localStorage.setItem('football-settings-horizontal', JSON.stringify(settings));
  }
}