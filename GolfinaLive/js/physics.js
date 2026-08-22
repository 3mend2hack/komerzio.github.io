export class Ball {
  constructor(width, height, radius, color, speed, targetGoal) {
    this.radius = radius;
    this.color = color;
    this.speed = speed;
    this.targetGoal = targetGoal;
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
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      const separationX = (overlap / 2) * nx;
      const separationY = (overlap / 2) * ny;
      this.x -= separationX;
      this.y -= separationY;
      other.x += separationX;
      other.y += separationY;
      
      const dvx = this.vx - other.vx;
      const dvy = this.vy - other.vy;
      const dvn = dvx * nx + dvy * ny;
      if (dvn > 0) return; // se están separando
      
      // Intercambio de componente normal (colisión elástica con masas iguales)
      this.vx -= dvn * nx;
      this.vy -= dvn * ny;
      other.vx += dvn * nx;
      other.vy += dvn * ny;
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