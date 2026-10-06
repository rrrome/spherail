window.Inkball = window.Inkball || {};

Inkball.Hole = class Hole {
  constructor(app, colorIndex, x, y) {
    this.app = app;
    this.colorIndex = colorIndex;
    this.x = x;
    this.y = y;
    this.width = 64;
    this.height = 64;
    this.image = app.holeImages[colorIndex];
    this.disabled = false;
  }

  draw(ctx) {
    if (this.image) {
      ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
    if (this.disabled) {
      // Grate overlay
      ctx.fillStyle = 'rgba(30, 30, 30, 0.45)';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= this.width; i += 8) {
        ctx.beginPath();
        ctx.moveTo(this.x + i, this.y);
        ctx.lineTo(this.x + i, this.y + this.height);
        ctx.stroke();
      }
      for (let j = 0; j <= this.height; j += 8) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + j);
        ctx.lineTo(this.x + this.width, this.y + j);
        ctx.stroke();
      }
    }
  }

  getCenter() {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  getColorIndex() {
    return this.colorIndex;
  }
};
