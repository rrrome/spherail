window.Inkball = window.Inkball || {};

Inkball.Line = class Line {
  constructor() {
    this.points = [];
  }

  addPoint(x, y) {
    this.points.push({ x, y });
  }

  getPoints() {
    return this.points;
  }

  draw(ctx) {
    if (this.points.length < 2) return;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Inkball.LINE_THICKNESS;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
  }

  containsPoint(x, y) {
    const threshold = Inkball.LINE_THICKNESS / 2;
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      if (this._pointNearLineSegment(p1, p2, x, y, threshold)) {
        return true;
      }
    }
    return false;
  }

  _pointNearLineSegment(p1, p2, x, y, threshold) {
    return this._distancePointToSegment({ x, y }, p1, p2) <= threshold;
  }

  _distancePointToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) {
      return Math.hypot(p.x - a.x, p.y - a.y);
    }
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const ab2 = dx * dx + dy * dy;
    let t = (apx * dx + apy * dy) / ab2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const projX = a.x + dx * t;
    const projY = a.y + dy * t;
    return Math.hypot(p.x - projX, p.y - projY);
  }
};
