(function (global) {
  function sizeOf(ball) {
    return typeof ball.size === "number" ? ball.size : 20;
  }

  function radiusOf(ball) {
    return typeof ball.collisionRadius === "number"
      ? ball.collisionRadius
      : sizeOf(ball) / 2;
  }

  function centerOf(ball) {
    return {
      x: ball.x + sizeOf(ball) / 2,
      y: ball.y + sizeOf(ball) / 2,
    };
  }

  function holeBounds(hole) {
    if (!hole || hole.disabled) return null;
    if (typeof hole.x === "number" && typeof hole.y === "number") {
      return {
        x: hole.x,
        y: hole.y,
        width: typeof hole.width === "number" ? hole.width : 64,
        height: typeof hole.height === "number" ? hole.height : 64,
      };
    }
    if (typeof hole.getCenter === "function") {
      const center = hole.getCenter();
      return { x: center.x - 32, y: center.y - 32, width: 64, height: 64 };
    }
    return null;
  }

  function isInHoleArea(ball, holes) {
    if (!holes || !holes.length) return false;
    const center = centerOf(ball);
    for (let index = 0; index < holes.length; index++) {
      const bounds = holeBounds(holes[index]);
      if (!bounds) continue;
      if (
        center.x >= bounds.x &&
        center.x < bounds.x + bounds.width &&
        center.y >= bounds.y &&
        center.y < bounds.y + bounds.height
      ) {
        return true;
      }
    }
    return false;
  }

  function bounceOffNormal(ball, normalX, normalY) {
    const speed = Math.hypot(ball.vx, ball.vy);
    const alongNormal = ball.vx * normalX + ball.vy * normalY;
    ball.vx -= 2 * alongNormal * normalX;
    ball.vy -= 2 * alongNormal * normalY;
    if (speed <= 0) return;
    const newSpeed = Math.hypot(ball.vx, ball.vy);
    if (newSpeed <= 0) return;
    ball.vx *= speed / newSpeed;
    ball.vy *= speed / newSpeed;
  }

  function resolveAll(balls, holes) {
    for (let i = 0; i < balls.length; i++) {
      const first = balls[i];
      if (first.isCaptured) continue;
      const firstInHole = isInHoleArea(first, holes);

      for (let j = i + 1; j < balls.length; j++) {
        const second = balls[j];
        if (second.isCaptured) continue;
        if (firstInHole || isInHoleArea(second, holes)) continue;

        const dx = (second.x + sizeOf(second) / 2) - (first.x + sizeOf(first) / 2);
        const dy = (second.y + sizeOf(second) / 2) - (first.y + sizeOf(first) / 2);
        const minimumDistance = radiusOf(first) + radiusOf(second);
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= minimumDistance * minimumDistance) continue;

        const distance = Math.sqrt(distanceSquared);
        let normalX;
        let normalY;
        if (distance > 0) {
          normalX = dx / distance;
          normalY = dy / distance;
        } else {
          const velocityX = first.vx - second.vx;
          const velocityY = first.vy - second.vy;
          const velocityMagnitude = Math.hypot(velocityX, velocityY);
          normalX = velocityMagnitude > 0 ? velocityX / velocityMagnitude : 1;
          normalY = velocityMagnitude > 0 ? velocityY / velocityMagnitude : 0;
        }

        const correction = (minimumDistance - distance) / 2;
        first.x -= normalX * correction;
        first.y -= normalY * correction;
        second.x += normalX * correction;
        second.y += normalY * correction;

        const relativeNormalVelocity =
          (second.vx - first.vx) * normalX +
          (second.vy - first.vy) * normalY;
        if (relativeNormalVelocity >= 0) continue;

        // Reflect each ball off the contact plane so both keep their speed.
        bounceOffNormal(first, normalX, normalY);
        bounceOffNormal(second, normalX, normalY);
      }
    }
  }

  global.InkballBallPhysics = { resolveAll: resolveAll };
})(window);
