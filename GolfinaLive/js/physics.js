export class Ball {
  constructor(width, height, radius, color, speed, targetGoal) {
    this.radius = radius;
    this.color = color;
    this.speed = speed;
    this.targetGoal = targetGoal;
    this.mass = 1; // masa unitaria para colisión elástica
    this.reset(width, height);
  }
  
  reset(width, height) {
    const margin = this.radius + 5;
    this.x = margin + Math.random() * Math.max(0, width - 2 * margin);
    this.y = margin + Math.random() * Math.max(0, height - 2 * margin);
    const angle = Math.random() * 2 * Math.PI;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
  }
  
  setSpeed(newSpeed) {
    this.speed = newSpeed;
    const currentSpeed = Math.hypot(this.vx, this.vy);
    if (currentSpeed > 0) {
      this.vx = (this.vx / currentSpeed) * newSpeed;
      this.vy = (this.vy / currentSpeed) * newSpeed;
    } else {
      const angle = Math.random() * 2 * Math.PI;
      this.vx = Math.cos(angle) * newSpeed;
      this.vy = Math.sin(angle) * newSpeed;
    }
  }
  
  update(deltaTime, field) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    
    // Rebote con paredes
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.vy = Math.abs(this.vy);
    } else if (this.y + this.radius > field.height) {
      this.y = field.height - this.radius;
      this.vy = -Math.abs(this.vy);
    }
    
    if (this.x - this.radius < 0) {
      if (this.isInsideGoalLeft(field)) {
        if (this.targetGoal === 'left') {
          return 'goal';
        } else {
          this.x = this.radius;
          this.vx = Math.abs(this.vx);
        }
      } else {
        this.x = this.radius;
        this.vx = Math.abs(this.vx);
      }
    } else if (this.x + this.radius > field.width) {
      if (this.isInsideGoalRight(field)) {
        if (this.targetGoal === 'right') {
          return 'goal';
        } else {
          this.x = field.width - this.radius;
          this.vx = -Math.abs(this.vx);
        }
      } else {
        this.x = field.width - this.radius;
        this.vx = -Math.abs(this.vx);
      }
    }
    return null;
  }
  
  collide(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    const dist = Math.hypot(dx, dy);
    const minDist = this.radius + other.radius;
    
    if (dist < minDist && dist > 0) {
      // Vector normal unitario (de this a other)
      const nx = dx / dist;
      const ny = dy / dist;
      // Vector tangente unitario
      const tx = -ny;
      const ty = nx;
      
      // Separar las pelotas para evitar superposición
      const overlap = minDist - dist;
      const totalMass = this.mass + other.mass;
      this.x -= (overlap * (other.mass / totalMass)) * nx;
      this.y -= (overlap * (other.mass / totalMass)) * ny;
      other.x += (overlap * (this.mass / totalMass)) * nx;
      other.y += (overlap * (this.mass / totalMass)) * ny;
      
      // Descomponer velocidades en componente normal y tangencial
      const v1n = this.vx * nx + this.vy * ny;
      const v1t = this.vx * tx + this.vy * ty;
      const v2n = other.vx * nx + other.vy * ny;
      const v2t = other.vx * tx + other.vy * ty;
      
      // Solo aplicar impulso si se están acercando (v1n - v2n > 0)
      if (v1n - v2n <= 0) return;
      
      // Colisión elástica entre masas iguales:
      // Intercambiar las componentes normales
      const newV1n = v2n;
      const newV2n = v1n;
      
      // Reconstruir vectores de velocidad
      this.vx = newV1n * nx + v1t * tx;
      this.vy = newV1n * ny + v1t * ty;
      other.vx = newV2n * nx + v2t * tx;
      other.vy = newV2n * ny + v2t * ty;
      
      // Normalizar las velocidades a la rapidez original de cada pelota
      // para mantener constante su velocidad (regla del juego)
      const mag1 = Math.hypot(this.vx, this.vy);
      if (mag1 > 0) {
        this.vx = (this.vx / mag1) * this.speed;
        this.vy = (this.vy / mag1) * this.speed;
      }
      const mag2 = Math.hypot(other.vx, other.vy);
      if (mag2 > 0) {
        other.vx = (other.vx / mag2) * other.speed;
        other.vy = (other.vy / mag2) * other.speed;
      }
    }
  }
  
  isInsideGoalLeft(field) {
    const goalHeight = field.height * field.goalMouthRatio;
    const goalTop = (field.height - goalHeight) / 2;
    return this.y > goalTop && this.y < goalTop + goalHeight;
  }
  
  isInsideGoalRight(field) {
    return this.isInsideGoalLeft(field);
  }
}