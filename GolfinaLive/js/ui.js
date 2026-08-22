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
  
  init() {
    this.bindEvents();
    this.loadSettings();
    this.applySettings();
    this.updatePlayerNamesDisplay();
    this.updatePlayerImagesDisplay();
    this.updateGoalTargetDisplay();
    this.updateGoalTargetInput();
  }
  
  bindEvents() {
    // ... (todos los eventos existentes)
    
    // Eventos del modal de nombres
    document.getElementById('btn-player-names').addEventListener('click', () => this.openNamesModal());
    document.getElementById('btn-close-modal').addEventListener('click', () => this.closeNamesModal());
    document.getElementById('btn-save-names').addEventListener('click', () => this.savePlayerNames());
    
    // Subida de imágenes
    document.getElementById('input-file-red').addEventListener('change', (e) => this.handleImageUpload(e, 'red'));
    document.getElementById('input-file-blue').addEventListener('change', (e) => this.handleImageUpload(e, 'blue'));
  }
  
  openNamesModal() {
    document.getElementById('input-name-red').value = this.playerNames.red;
    document.getElementById('input-name-blue').value = this.playerNames.blue;
    // Mostrar imágenes actuales (opcional)
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
  
  // Nueva función para manejar la subida de imagen
  async handleImageUpload(event, team) {
    const file = event.target.files[0];
    if (!file) return;
    
    const bucketName = 'jugadores'; // ⚠️ Reemplaza con tu bucket real
    const path = `${team}/${Date.now()}-${file.name}`; // carpeta por equipo
    
    try {
      // Subir archivo a Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);
      
      const publicUrl = publicUrlData.publicUrl;
      
      // Actualizar imagen en la interfaz y en los datos
      this.playerImages[team] = publicUrl;
      this.updatePlayerImagesDisplay();
      this.saveSettings();
      
      // Mostrar preview en el modal
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
  
  updatePlayerNamesDisplay() {
    document.getElementById('player-name-red').textContent = this.playerNames.red;
    document.getElementById('player-name-blue').textContent = this.playerNames.blue;
  }
  
  updatePlayerImagesDisplay() {
    document.getElementById('player-image-red').querySelector('img').src = this.playerImages.red;
    document.getElementById('player-image-blue').querySelector('img').src = this.playerImages.blue;
  }
  
  // ... (resto de métodos existentes, sin cambios)
  
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
      },
      playerImages: {
        red: this.playerImages.red,
        blue: this.playerImages.blue
      }
    };
    localStorage.setItem('football-settings-horizontal', JSON.stringify(settings));
  }
}