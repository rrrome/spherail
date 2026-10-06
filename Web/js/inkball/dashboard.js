window.Inkball = window.Inkball || {};

Inkball.Dashboard = class Dashboard {
  constructor(app) {
    this.app = app;
    this.ballIcons = [];
    this.isAnimating = false;
    this.maxBallsToShow = 5;
    this.iconSpacing = 20;
    this.xPosition = 15;
    this.yPosition = 25;
    this.initializeBallIcons();
  }

  initializeBallIcons() {
    this.ballIcons = [];
    if (!this.app.currentLevel) return;
    const ballsToShow = Math.min(this.app.currentLevel.ballsYetToSpawn.length, this.maxBallsToShow);
    for (let i = 0; i < ballsToShow; i++) {
      const color = this.app.currentLevel.ballsYetToSpawn[i];
      const colorIndex = this.app.currentLevel.colorStringToIndex(color);
      this.ballIcons.push(new Inkball.BallIcon(
        colorIndex,
        this.xPosition + i * this.iconSpacing,
        this.yPosition
      ));
    }
  }

  draw(ctx, dt) {
    this.drawBrickBar(ctx);

    ctx.fillStyle = '#f4ead5';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(Inkball.t('game.score', { score: this.app.score }), 450, 20);

    if (this.app.isGameEnded) {
      ctx.textAlign = 'center';
      ctx.font = '25px sans-serif';
      ctx.fillText(Inkball.t('game.ended'), Inkball.WIDTH / 2, Inkball.TOPBAR_HEIGHT / 2);
      return;
    }

    if (!this.app.currentLevel) return;

    if (this.app.currentLevel.levelTimer >= 0) {
      const secondsLeft = Math.max(0, Math.floor(this.app.currentLevel.levelTimer));
      ctx.textAlign = 'left';
      ctx.fillStyle = this.app.currentLevel.levelTimer <= 10 ? '#ffab96' : '#bad8be';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(Inkball.t('game.time', { seconds: secondsLeft }), 450, 40);
    }

    if (this.app.currentLevel.levelTimer >= 0 && this.app.currentLevel.ballsYetToSpawn.length > 0) {
      const secondsLeft = Math.round(this.app.currentLevel.spawnTimer * 10) / 10;
      ctx.fillStyle = '#bad8be';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(Inkball.t('game.nextBall', { seconds: secondsLeft }), 10, 50);
    }

    this.updateBallIcons(dt);
    this.drawBallIcons(ctx);
  }

  drawBrickBar(ctx) {
    // Only the 64px HUD is restyled; the level renderer and sprites are unchanged.
    ctx.fillStyle = '#254b4e';
    ctx.fillRect(0, 0, Inkball.WIDTH, Inkball.TOPBAR_HEIGHT);
    ctx.fillStyle = '#17383b';
    ctx.fillRect(6, 6, 150, 52);
    ctx.fillRect(438, 6, 132, 52);
    ctx.fillStyle = '#76917b';
    ctx.fillRect(0, Inkball.TOPBAR_HEIGHT - 2, Inkball.WIDTH, 2);
    if (!this.app.isGameEnded) {
      ctx.fillStyle = '#f1e3c6';
      ctx.font = 'bold 21px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SPHERAIL', Inkball.WIDTH / 2, 25);
      ctx.fillStyle = '#b5c7bb';
      ctx.font = '10px sans-serif';
      ctx.fillText(Inkball.t('ui.gameTagline'), Inkball.WIDTH / 2, 44);
    }
  }

  updateBallIcons(dt) {
    if (!this.isAnimating) return;
    let allComplete = true;
    for (const icon of this.ballIcons) {
      if (icon.isAnimating) {
        icon.updatePosition(dt);
        allComplete = false;
      }
    }
    if (allComplete) this.isAnimating = false;
  }

  drawBallIcons(ctx) {
    for (const icon of this.ballIcons) {
      const img = this.app.ballImages[icon.colorIndex];
      if (img && typeof Inkball.drawBallImage === 'function') {
        Inkball.drawBallImage(ctx, img, icon.x, icon.y, 16);
      } else if (img) {
        ctx.drawImage(img, icon.x, icon.y, 16, 16);
      }
    }
  }

  onBallSpawned() {
    // ballsYetToSpawn has already been shifted by spawnNextBall(). Icons must
    // stay in lock-step with that live queue — including balls re-queued after
    // a wrong-hole capture — not the original ballsToSpawn config list.
    if (this.ballIcons.length > 0) {
      this.ballIcons.shift();
    }

    for (let i = 0; i < this.ballIcons.length; i++) {
      const icon = this.ballIcons[i];
      icon.setTargetPosition(this.xPosition + i * this.iconSpacing, icon.y);
    }
    this.isAnimating = true;

    const queue = this.app.currentLevel.ballsYetToSpawn;
    const ballsDisplayed = this.ballIcons.length;

    if (ballsDisplayed < this.maxBallsToShow && queue.length > ballsDisplayed) {
      const color = queue[ballsDisplayed];
      const colorIndex = this.app.currentLevel.colorStringToIndex(color);
      const newIcon = new Inkball.BallIcon(
        colorIndex,
        this.xPosition + (ballsDisplayed + 1) * this.iconSpacing,
        this.yPosition
      );
      newIcon.setTargetPosition(this.xPosition + ballsDisplayed * this.iconSpacing, this.yPosition);
      this.ballIcons.push(newIcon);
      this.isAnimating = true;
    }
  }

  onBallsYetToSpawnChanged() {
    this.initializeBallIcons();
    this.isAnimating = false;
  }

  reset() {
    this.initializeBallIcons();
    this.isAnimating = false;
  }
};

Inkball.BallIcon = class BallIcon {
  constructor(colorIndex, x, y) {
    this.colorIndex = colorIndex;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.isAnimating = false;
  }

  setTargetPosition(targetX, targetY) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.isAnimating = true;
  }

  updatePosition(dt) {
    const speed = Inkball.DASH_ICON_SPEED * Inkball.stepDt(dt);
    if (this.x > this.targetX) {
      this.x -= speed;
      if (this.x <= this.targetX) {
        this.x = this.targetX;
        this.isAnimating = false;
      }
    } else if (this.x < this.targetX) {
      this.x += speed;
      if (this.x >= this.targetX) {
        this.x = this.targetX;
        this.isAnimating = false;
      }
    } else {
      this.isAnimating = false;
    }
  }
};
