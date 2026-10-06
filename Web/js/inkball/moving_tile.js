window.Inkball = window.Inkball || {};

Inkball.MovingTile = class MovingTile {
  constructor(app, startX, startY, path) {
    this.app = app;
    this.startX = startX;
    this.startY = startY;
    this.x = startX;
    this.y = startY;
    this.path = path;
    this.pathIndex = 0;
    this.image = app.wallImages[4];
  }

  update() {
    this.pathIndex = (this.pathIndex + 1) % this.path.length;
    this.x = this.path[this.pathIndex].x;
    this.y = this.path[this.pathIndex].y;
  }

  draw(ctx) {
    if (!this.image) return;
    const drawX = this.x * Inkball.CELLSIZE;
    const drawY = this.y * Inkball.CELLSIZE + Inkball.TOP_OFFSET;
    ctx.drawImage(this.image, drawX, drawY, Inkball.CELLSIZE, Inkball.CELLSIZE);
  }
};
