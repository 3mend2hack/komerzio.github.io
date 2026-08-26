export class Stadium {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }
  
  draw(field, neonMode = false) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(field.offsetX, field.offsetY);
    this.drawField(ctx, field, neonMode);
    ctx.restore();
  }
  
  drawField(ctx, field, neonMode = false) {
    const grassGradient = ctx.createLinearGradient(0, 0, field.width, 0);
    grassGradient.addColorStop(0, neonMode ? '#0a1a0a' : '#2e8b57');
    grassGradient.addColorStop(0.5, neonMode ? '#0a2a0a' : '#3cb371');
    grassGradient.addColorStop(1, neonMode ? '#0a1a0a' : '#2e8b57');
    ctx.fillStyle = grassGradient;
    ctx.fillRect(0, 0, field.width, field.height);
    
    // Líneas blancas o neón según modo
    ctx.strokeStyle = neonMode ? '#aaaaaa' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, field.width, field.height);
    
    ctx.beginPath();
    ctx.moveTo(field.width / 2, 0);
    ctx.lineTo(field.width / 2, field.height);
    ctx.stroke();
    
    const centerRadius = field.height * 0.2;
    ctx.beginPath();
    ctx.arc(field.width / 2, field.height / 2, centerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    const penaltyAreaWidth = field.width * 0.2;
    const penaltyAreaHeight = field.height * 0.6;
    const goalAreaWidth = field.width * 0.1;
    const goalAreaHeight = field.height * 0.3;
    
    ctx.strokeRect(0, (field.height - penaltyAreaHeight) / 2, penaltyAreaWidth, penaltyAreaHeight);
    ctx.strokeRect(0, (field.height - goalAreaHeight) / 2, goalAreaWidth, goalAreaHeight);
    
    ctx.strokeRect(field.width - penaltyAreaWidth, (field.height - penaltyAreaHeight) / 2, penaltyAreaWidth, penaltyAreaHeight);
    ctx.strokeRect(field.width - goalAreaWidth, (field.height - goalAreaHeight) / 2, goalAreaWidth, goalAreaHeight);
    
    ctx.fillStyle = neonMode ? '#ffffff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(penaltyAreaWidth * 0.7, field.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(field.width - penaltyAreaWidth * 0.7, field.height / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    
    const cornerRadius = 10;
    ctx.beginPath();
    ctx.arc(0, 0, cornerRadius, 0, Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(field.width, 0, cornerRadius, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, field.height, cornerRadius, 0, -Math.PI / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(field.width, field.height, cornerRadius, Math.PI / 2, Math.PI);
    ctx.stroke();
    
    // Porterías
    this.drawGoal(ctx, field, 'left', field.goalMouthRatioLeft, neonMode);
    this.drawGoal(ctx, field, 'right', field.goalMouthRatioRight, neonMode);
  }
  
  drawGoal(ctx, field, side, goalMouthRatio, neonMode = false) {
    const goalWidth = Math.min(20, field.width * 0.05);
    const goalHeight = field.height * goalMouthRatio;
    const top = (field.height - goalHeight) / 2;
    const left = side === 'left' ? -goalWidth : field.width;
    const right = side === 'left' ? 0 : field.width + goalWidth;
    
    // Color normal o neón
    let goalColor;
    if (neonMode) {
      goalColor = side === 'left' ? '#ff00ff' : '#00ffff'; // Neón rojo / azul brillante
    } else {
      goalColor = side === 'left' ? '#ff0000' : '#0000ff'; // Normal
    }
    
    ctx.strokeStyle = goalColor;
    ctx.lineWidth = neonMode ? 5 : 4;
    if (neonMode) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = goalColor;
    }
    ctx.strokeRect(left, top, goalWidth, goalHeight);
    
    // Red
    ctx.strokeStyle = neonMode ? goalColor : 'rgba(200,200,200,0.7)';
    ctx.lineWidth = 1;
    const spacing = 6;
    for (let y = top; y <= top + goalHeight; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    for (let x = left; x <= right; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + goalHeight);
      ctx.stroke();
    }
    
    // Resetear sombra
    if (neonMode) {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  }
}