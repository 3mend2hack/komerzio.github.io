export class Ball {
  constructor(width, height, radius, color, speed, targetGoal, team) {
    this.radius = radius;
    this.color = color;
    this.speed = speed;
    this.targetGoal = targetGoal; // 'left' o 'right'
    this.team = team; // 'red' o 'blue'
    this.mass = 1;
    this.isClone = false; // Indica si es una pelota extra
    this.expireTime = null; // Si es clon, cuando expira
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
    
    // Gol solo si es pelota original (o todas cuentan)
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
      const totalMass = this.mass + other.mass;
      this.x -= (overlap * (other.mass / totalMass)) * nx;
      this.y -= (overlap * (other.mass / totalMass)) * ny;
      other.x += (overlap * (this.mass / totalMass)) * nx;
      other.y += (overlap * (this.mass / totalMass)) * ny;
      
      const dvx = this.vx - other.vx;
      const dvy = this.vy - other.vy;
      const dvn = dvx * nx + dvy * ny;
      if (dvn > 0) return;
      
      this.vx -= dvn * nx;
      this.vy -= dvn * ny;
      other.vx += dvn * nx;
      other.vy += dvn * ny;
      
      // Mantener rapidez constante
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
    const goalHeight = field.height * field.goalMouthRatioLeft;
    const goalTop = (field.height - goalHeight) / 2;
    return this.y > goalTop && this.y < goalTop + goalHeight;
  }
  
  isInsideGoalRight(field) {
    const goalHeight = field.height * field.goalMouthRatioRight;
    const goalTop = (field.height - goalHeight) / 2;
    return this.y > goalTop && this.y < goalTop + goalHeight;
  }
}