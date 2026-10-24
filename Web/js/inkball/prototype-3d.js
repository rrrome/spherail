import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BOOT_NODE = document.getElementById('inkball-3d-map');
const ROOT = document.querySelector('[data-prototype-3d]');
const CANVAS = document.querySelector('[data-prototype-canvas]');
const SCORE_NODE = document.querySelector('[data-prototype-score]');
const TIME_NODE = document.querySelector('[data-prototype-time]');
const NEXT_NODE = document.querySelector('[data-prototype-next]');
const QUEUE_NODE = document.querySelector('[data-prototype-queue]');
const TOOLS = document.querySelector('[data-prototype-tools]');
const TOOL_BUTTONS = document.querySelectorAll('[data-prototype-tool]');
const CAMERA_LOCK = document.querySelector('[data-prototype-camera-lock]');
const MAX_VISIBLE_QUEUED_BALLS = 5;
const RESULT = document.querySelector('[data-prototype-result]');
const BRIEFING = document.querySelector('[data-prototype-briefing]');
const PAUSE_OPEN = document.querySelector('[data-prototype-pause-open]');
const PAUSE_OVERLAY = document.querySelector('[data-prototype-pause-overlay]');
const PAUSE_HOME = document.querySelector('[data-prototype-pause-home]');
const PAUSE_RESTART = document.querySelector('[data-prototype-pause-restart]');
const PAUSE_RESUME = document.querySelector('[data-prototype-pause-resume]');
const COLORS = ['#b1b7b6', '#e0986f', '#73a3c7', '#7daf8d', '#d9bd58'];
const GLASS_COLORS = ['#687778', '#a94f27', '#246a9f', '#327649', '#9d811c'];
const BALL_COLORS = ['#9aa0a6', '#f4a261', '#4ea1f3', '#6fcf97', '#f2c94c'];
const WALL_COLORS = ['#747f7e', '#8f6047', '#507a99', '#568266', '#958340'];
const WALL_FACE_COLORS = ['#c7ccc7', '#d18b5e', '#6d9fc4', '#72aa82', '#c7ad52'];
const BRICK_COLORS = ['#e7e5dc', '#dfa37e', '#91b5cf', '#95bd9f', '#dcc86f'];
const BRICK_FACE_COLORS = ['#f3f0e7', '#f1b990', '#a8cce3', '#afd4b7', '#ead782'];
const HOLE_COLORS = ['#dce2e1', '#f0ae83', '#98c3df', '#9acbac', '#e6ce74'];
const ROWS = 18;
const COLS = 18;
const PREVIEW_CAMERA_POSITION = new THREE.Vector3(0, 26.8, 17.4);
const PREVIEW_CAMERA_TARGET = new THREE.Vector3(0, 0, 0.1);
const PLAY_CAMERA_POSITION = new THREE.Vector3(0, 20.2, 12.6);
const PLAY_CAMERA_TARGET = new THREE.Vector3(0, 0, 0.35);
const CAMERA_ZOOM_DURATION_MS = 920;
const HOLE_PULL_RADIUS = 32 / Inkball.CELLSIZE;
const BALL_RADIUS = 10 / Inkball.CELLSIZE;
const HOLE_VISIBLE_RADIUS = HOLE_PULL_RADIUS - BALL_RADIUS;
const HOLE_FUNNEL_RADIUS = HOLE_VISIBLE_RADIUS - 0.1;
const TEXTURE_MAX_SIZE = 1024;
const RENDER_PIXEL_RATIO_CAP = 1.5;
const SHADOW_MAP_SIZE = 1024;
const AMBIENT_FLOOR_COLS = 85;
const AMBIENT_FLOOR_ROWS = 72;
const AMBIENT_FOG_COLOR = new THREE.Color('#1c3a3e');
const AMBIENT_BODY_COLOR = '#aebbb5';
const AMBIENT_FACE_COLOR = '#c1cbc5';
const textureLoader = new THREE.TextureLoader();

function limitTextureImage(texture, maxSize = TEXTURE_MAX_SIZE) {
  const image = texture.image;
  if (!image || image.width <= maxSize && image.height <= maxSize) return;
  const scale = maxSize / Math.max(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'medium';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  texture.image = canvas;
  texture.needsUpdate = true;
}

function loadRuntimeTexture(url, maxSize = TEXTURE_MAX_SIZE) {
  return textureLoader.load(url, (texture) => {
    limitTextureImage(texture, maxSize);
  });
}

const gridTexture = loadRuntimeTexture('textures/prototype-3d/kenney-grid.png');
const metalNormal = loadRuntimeTexture('textures/prototype-3d/low/metal-normal.webp', 768);
const metalRoughness = loadRuntimeTexture('textures/prototype-3d/low/metal-roughness.webp', 768);
const metalnessMap = loadRuntimeTexture('textures/prototype-3d/low/metal-metalness.webp', 768);
const plasterDiffuse = loadRuntimeTexture('textures/prototype-3d/low/plastered-wall-diffuse.webp');
const plasterNormal = loadRuntimeTexture('textures/prototype-3d/low/plastered-wall-normal.webp');
const plasterRoughness = loadRuntimeTexture('textures/prototype-3d/low/plastered-wall-roughness.webp');
const plasterAO = loadRuntimeTexture('textures/prototype-3d/low/plastered-wall-ao.webp');
const holeMetalColor = loadRuntimeTexture('textures/prototype-3d/low/hole-metal-color.webp');
const holeMetalNormal = loadRuntimeTexture('textures/prototype-3d/low/hole-metal-normal.webp');
const holeMetalRoughness = loadRuntimeTexture('textures/prototype-3d/low/hole-metal-roughness.webp');
const holeMetalMetalness = loadRuntimeTexture('textures/prototype-3d/low/hole-metal-metalness.webp');
const holePlateColor = loadRuntimeTexture('textures/prototype-3d/low/hole-plate-color.webp');
const holePlateNormal = loadRuntimeTexture('textures/prototype-3d/low/hole-plate-normal.webp');
const holePlateRoughness = loadRuntimeTexture('textures/prototype-3d/low/hole-plate-roughness.webp');
const holePlateMetalness = loadRuntimeTexture('textures/prototype-3d/low/hole-plate-metalness.webp');
const ballMatcap = loadRuntimeTexture('textures/prototype-3d/ball-matcap.png', 256);

gridTexture.colorSpace = THREE.SRGBColorSpace;
ballMatcap.colorSpace = THREE.SRGBColorSpace;
gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping;
gridTexture.repeat.set(0.25, 0.25);
[metalNormal, metalRoughness, metalnessMap].forEach((texture) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
});
[plasterDiffuse, plasterNormal, plasterRoughness, plasterAO].forEach((texture) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.35, 1.35);
});
plasterDiffuse.colorSpace = THREE.SRGBColorSpace;
[holeMetalColor, holeMetalNormal, holeMetalRoughness, holeMetalMetalness].forEach((texture) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.46, 0.46);
});
holeMetalColor.colorSpace = THREE.SRGBColorSpace;
[holePlateColor, holePlateNormal, holePlateRoughness, holePlateMetalness].forEach((texture) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.34, 0.34);
});
holePlateColor.colorSpace = THREE.SRGBColorSpace;

function parseLayout(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairMode = lines.some((line) => line.length > COLS);
  return Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => ({
    token: pairMode ? (lines[y] || '').charAt(x * 2) || ' ' : (lines[y] || '').charAt(x) || ' ',
    attr: pairMode ? (lines[y] || '').charAt(x * 2 + 1) || ' ' : ' ',
  })));
}

function worldXFromPixel(x) { return x / Inkball.CELLSIZE - COLS / 2; }
function worldZFromPixel(y) { return (y - Inkball.TOP_OFFSET) / Inkball.CELLSIZE - ROWS / 2; }
function worldXFromCell(x) { return x - COLS / 2 + 0.5; }
function worldZFromCell(y) { return y - ROWS / 2 + 0.5; }
function pixelFromWorld(point) {
  return {
    x: (point.x + COLS / 2) * Inkball.CELLSIZE,
    y: (point.z + ROWS / 2) * Inkball.CELLSIZE + Inkball.TOP_OFFSET,
  };
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function randomizeUv(geometry, seed, coverage = 0.46) {
  const uv = geometry.attributes.uv;
  if (!uv) return geometry;
  const turn = Math.floor(seededUnit(seed) * 4);
  const offsetU = seededUnit(seed + 11.7) * (1 - coverage);
  const offsetV = seededUnit(seed + 29.3) * (1 - coverage);
  for (let i = 0; i < uv.count; i += 1) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const rotated = [
      [u, v], [v, 1 - u], [1 - u, 1 - v], [1 - v, u],
    ][turn];
    uv.setXY(i, offsetU + rotated[0] * coverage, offsetV + rotated[1] * coverage);
  }
  uv.needsUpdate = true;
  if (geometry.attributes.uv1) geometry.setAttribute('uv1', uv.clone());
  return geometry;
}

function material(color, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function metalMaterial(color, roughness = 0.62, metalness = 0.5, useGrid = false) {
  const result = material(color, roughness, metalness);
  result.normalMap = metalNormal;
  result.normalScale.set(0.26, 0.26);
  result.roughnessMap = metalRoughness;
  result.metalnessMap = metalnessMap;
  if (useGrid) result.map = gridTexture;
  return result;
}

function concreteMaterial(color = '#c8cbc5') {
  const result = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.18,
  });
  return result;
}

function solidWallMaterial(color = '#eceeea') {
  const result = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.16,
  });
  return result;
}

function ambientBlockMaterial(color, fogAmount = 0) {
  const visibleColor = new THREE.Color(color).lerp(AMBIENT_FOG_COLOR, fogAmount);
  const result = solidWallMaterial(visibleColor);
  result.roughness = 0.98;
  result.envMapIntensity *= 0.32 * (1 - fogAmount * 0.72);
  return result;
}

function wornMetalMaterial(color = '#d8dde2') {
  const result = new THREE.MeshStandardMaterial({
    color,
    map: holeMetalColor,
    normalMap: holeMetalNormal,
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughnessMap: holeMetalRoughness,
    roughness: 0.54,
    metalnessMap: holeMetalMetalness,
    metalness: 0.78,
    envMapIntensity: 0.58,
  });
  return result;
}

function holeMetalMaterial(color = '#d8dde2') {
  const result = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.12,
    map: holePlateColor,
    normalMap: holePlateNormal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: holePlateRoughness,
    roughness: 0.46,
    metalnessMap: holePlateMetalness,
    metalness: 0.82,
    envMapIntensity: 0.72,
  });
  return result;
}

function floorMaterial() {
  const result = material('#a7b7b1', 0.96, 0);
  result.map = plasterDiffuse;
  result.normalMap = plasterNormal;
  result.normalScale.set(0.12, 0.12);
  result.roughnessMap = plasterRoughness;
  result.aoMap = plasterAO;
  result.aoMapIntensity = 0.22;
  result.envMapIntensity = 0.08;
  return result;
}

function box(scene, geometry, meshMaterial, x, y, z, scaleY = 1) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(x, y, z);
  mesh.scale.y = scaleY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function carvedHoleTileGeometry() {
  const half = 0.98;
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.closePath();
  const opening = new THREE.Path();
  opening.absarc(0, 0, HOLE_FUNNEL_RADIUS, 0, Math.PI * 2, true);
  shape.holes.push(opening);
  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: false,
    curveSegments: 48,
  });
}

function addCarvedHoleTile(scene, geometry, meshMaterial, x, z) {
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.set(x, 0, z);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Rounded topology is expensive to generate. Keep a bounded set of shared UV
// variants so walls retain texture variation without rebuilding their topology.
const wallGeometryTemplates = {
  shell: new RoundedBoxGeometry(0.94, 0.78, 0.94, 5, 0.1),
  face: new RoundedBoxGeometry(0.78, 0.65, 0.78, 5, 0.11),
};
const wallGeometryPool = new Map();
const sharedWallGeometry = new Set();
function wallGeometry(part, seed) {
  const variant = Math.abs(Math.round(seed)) % 12;
  const key = `${part}:${variant}`;
  if (!wallGeometryPool.has(key)) {
    const geometry = wallGeometryTemplates[part].clone();
    geometry.setAttribute('uv1', geometry.attributes.uv);
    randomizeUv(geometry, variant + (part === 'face' ? 37 : 0), 0.27);
    wallGeometryPool.set(key, geometry);
    sharedWallGeometry.add(geometry);
  }
  return wallGeometryPool.get(key);
}

function addWall(scene, x, z, index) {
  const shellColor = index === 0 ? '#eceeea' : WALL_COLORS[index];
  const shellGeometry = wallGeometry('shell', x * 97 + z * 53 + index * 17);
  const shell = new THREE.Mesh(
    shellGeometry,
    solidWallMaterial(shellColor)
  );
  shell.position.set(x, 0.39, z);
  shell.castShadow = true;
  shell.receiveShadow = true;
  scene.add(shell);

  const faceGeometry = wallGeometry('face', x * 71 + z * 89 + index * 23 + 5);
  const face = new THREE.Mesh(faceGeometry, solidWallMaterial(WALL_FACE_COLORS[index]));
  face.position.set(x, 0.48, z);
  face.castShadow = true;
  scene.add(face);
}

function createAmbientBlockField(scene, enabled) {
  if (!enabled) return null;
  const root = new THREE.Group();
  root.visible = Boolean(enabled);
  root.position.set(0, -5.4, 0);
  scene.add(root);

  const glassHeight = 0.78;
  const glassWidth = (AMBIENT_FLOOR_COLS - 1) * 1.84 + 1.72 + 0.4;
  const glassDepth = (AMBIENT_FLOOR_ROWS - 1) * 1.8 + 1.72 + 0.4;
  const glass = new THREE.Mesh(
    new RoundedBoxGeometry(glassWidth, glassHeight, glassDepth, 3, 0.12),
    new THREE.MeshPhysicalMaterial({
      color: '#365b59',
      roughness: 0.72,
      metalness: 0,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      transmission: 0,
      thickness: glassHeight,
      ior: 1.45,
      attenuationColor: new THREE.Color('#244744'),
      attenuationDistance: 1.2,
      envMapIntensity: 0.12,
    })
  );
  // Keep the glass below the board and above the animated background bricks.
  glass.position.y = -root.position.y - 0.65 - glassHeight / 2;
  root.add(glass);

  const bodyGeometry = new RoundedBoxGeometry(1.72, 2, 1.72, 5, 0.19);
  const faceGeometry = new RoundedBoxGeometry(1.36, 2, 1.36, 4, 0.16);
  const materialSets = new Map();

  function materialSet(index, visibilityBand) {
    const key = `${index}:${visibilityBand}`;
    if (!materialSets.has(key)) {
      const fogAmount = [0.74, 0.58, 0.42, 0.24, 0.06][visibilityBand] || 0;
      materialSets.set(key, {
        body: ambientBlockMaterial(index === 0 ? AMBIENT_BODY_COLOR : WALL_COLORS[index], fogAmount),
        face: ambientBlockMaterial(index === 0 ? AMBIENT_FACE_COLOR : WALL_FACE_COLORS[index], fogAmount),
        items: [],
      });
    }
    return materialSets.get(key);
  }

  for (let row = 0; row < AMBIENT_FLOOR_ROWS; row += 1) {
    for (let col = 0; col < AMBIENT_FLOOR_COLS; col += 1) {
      const seed = row * 127 + col * 311;
      const colorRoll = seededUnit(seed + 17);
      const colorIndex = colorRoll < 0.14 ? 1 + Math.floor(seededUnit(seed + 23) * 4) : 0;
      const height = 0.56 + seededUnit(seed + 5) * 0.24;
      const x = (col - (AMBIENT_FLOOR_COLS - 1) / 2) * 1.84;
      const z = (row - (AMBIENT_FLOOR_ROWS - 1) / 2) * 1.8;
      const distanceX = Math.abs(x) / (AMBIENT_FLOOR_COLS * 0.92);
      const distanceZ = Math.abs(z) / (AMBIENT_FLOOR_ROWS * 0.9);
      const distanceRatio = THREE.MathUtils.clamp(Math.max(distanceX, distanceZ), 0, 1);
      const visibilityBand = Math.min(4, Math.floor((1 - Math.pow(distanceRatio, 1.28)) * 5));
      materialSet(colorIndex, visibilityBand).items.push({
        x,
        z,
        height,
        baseY: height,
        phase: seededUnit(seed + 71) * Math.PI * 2,
        amplitude: 0.16 + seededUnit(seed + 97) * 0.18,
        tempo: 0.78 + seededUnit(seed + 131) * 0.34,
      });
    }
  }

  const entries = Array.from(materialSets.values())
    .filter((set) => set.items.length)
    .map((set) => {
      const body = new THREE.InstancedMesh(bodyGeometry, set.body, set.items.length);
      const face = new THREE.InstancedMesh(faceGeometry, set.face, set.items.length);
      body.castShadow = true;
      body.receiveShadow = true;
      face.castShadow = true;
      face.receiveShadow = true;
      body.frustumCulled = false;
      face.frustumCulled = false;
      root.add(body, face);
      return { body, face, items: set.items };
    });

  return {
    root,
    entries,
    matrixTarget: new THREE.Object3D(),
  };
}

function updateAmbientBlockField(field, elapsed) {
  if (!field || !field.root.visible) return;
  const target = field.matrixTarget;
  field.entries.forEach((entry) => {
    entry.items.forEach((item, index) => {
      const pulse = Math.sin(elapsed * item.tempo + item.phase) * item.amplitude;
      const drift = Math.sin(elapsed * 0.42 + item.phase * 0.6) * item.amplitude * 0.35;
      const y = item.baseY + pulse + drift;
      target.position.set(item.x, y, item.z);
      target.scale.set(1, item.height, 1);
      target.rotation.set(0, 0, 0);
      target.updateMatrix();
      entry.body.setMatrixAt(index, target.matrix);

      target.position.set(item.x, y + item.height + 0.07, item.z);
      target.scale.set(1, 0.065, 1);
      target.updateMatrix();
      entry.face.setMatrixAt(index, target.matrix);
    });
    entry.body.instanceMatrix.needsUpdate = true;
    entry.face.instanceMatrix.needsUpdate = true;
  });
}

function markerTexture(label, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, 128, 128);
  context.fillStyle = color;
  context.beginPath();
  context.arc(64, 64, 52, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.85)';
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = '#172326';
  context.font = '900 64px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createTopMarker(label, color, size = 0.52) {
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: markerTexture(label, color), transparent: true, depthWrite: false })
  );
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 4;
  return marker;
}

function addTopMarker(scene, x, y, z, label, color, size = 0.52) {
  const marker = createTopMarker(label, color, size);
  marker.position.set(x, y, z);
  scene.add(marker);
}

function addKeyWall(scene, x, z, index) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const solid = new THREE.Group();
  const shellColor = BRICK_COLORS[index];
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(0.94, 0.78, 0.94, 5, 0.1),
    metalMaterial(shellColor, 0.3, 0.8)
  );
  shell.position.y = 0.39;
  shell.castShadow = true;
  solid.add(shell);
  const face = new THREE.Mesh(
    new RoundedBoxGeometry(0.78, 0.65, 0.78, 5, 0.11),
    metalMaterial(COLORS[index], 0.24, 0.42)
  );
  face.position.y = 0.48;
  face.castShadow = true;
  solid.add(face);
  const solidMarker = createTopMarker('Y', COLORS[index]);
  solidMarker.position.y = 0.82;
  solid.add(solidMarker);

  const passable = new THREE.Group();
  const ghost = new THREE.Mesh(
    new RoundedBoxGeometry(0.86, 0.12, 0.86, 4, 0.06),
    new THREE.MeshPhysicalMaterial({
      color: GLASS_COLORS[index], transparent: true, opacity: 0.34,
      roughness: 0.3, transmission: 0.14, depthWrite: false,
    })
  );
  ghost.position.y = 0.08;
  passable.add(ghost);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.12, 0.86)),
    new THREE.LineBasicMaterial({ color: GLASS_COLORS[index], transparent: true, opacity: 0.85 })
  );
  outline.position.y = 0.08;
  passable.add(outline);
  const passableMarker = createTopMarker('Y', COLORS[index], 0.42);
  passableMarker.position.y = 0.155;
  passable.add(passableMarker);
  passable.visible = false;

  root.add(solid, passable);
  root.userData.solid = solid;
  root.userData.passable = passable;
  scene.add(root);
  return root;
}

function addMechanismSwitch(scene, x, z, index, label) {
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(0.82, 0.34, 0.82, 5, 0.08),
    metalMaterial('#c9d0d2', 0.38, 0.62)
  );
  base.position.set(x, 0.17, z);
  base.castShadow = true;
  scene.add(base);
  const button = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.35, 0.13, 32),
    metalMaterial(COLORS[index], 0.26, 0.48)
  );
  button.position.set(x, 0.39, z);
  button.castShadow = true;
  scene.add(button);
  addTopMarker(scene, x, 0.465, z, label, COLORS[index], 0.48);
}

function addTimedWall(scene, x, z) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(0.94, 0.78, 0.94, 5, 0.1),
    metalMaterial('#dce2ec', 0.3, 0.8)
  );
  shell.position.y = 0.39;
  shell.castShadow = true;
  root.add(shell);
  const face = new THREE.Mesh(
    new RoundedBoxGeometry(0.78, 0.65, 0.78, 5, 0.11),
    metalMaterial('#eef1fb', 0.24, 0.42)
  );
  face.position.y = 0.48;
  face.castShadow = true;
  root.add(face);
  const countdownCanvas = document.createElement('canvas');
  countdownCanvas.width = 128;
  countdownCanvas.height = 128;
  const countdownContext = countdownCanvas.getContext('2d');
  const countdownTexture = new THREE.CanvasTexture(countdownCanvas);
  countdownTexture.colorSpace = THREE.SRGBColorSpace;
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.58),
    new THREE.MeshBasicMaterial({ map: countdownTexture, transparent: true, depthWrite: false })
  );
  marker.position.y = 0.82;
  marker.rotation.x = -Math.PI / 2;
  marker.renderOrder = 4;
  root.add(marker);
  root.userData.countdown = { canvas: countdownCanvas, context: countdownContext, texture: countdownTexture, value: null };
  scene.add(root);
  return root;
}

function updateTimedWallLabel(visual, seconds) {
  const countdown = visual.userData.countdown;
  if (!countdown || countdown.value === seconds) return;
  countdown.value = seconds;
  const { context, texture } = countdown;
  context.clearRect(0, 0, 128, 128);
  context.fillStyle = '#dce2ec';
  context.beginPath();
  context.arc(64, 64, 52, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.9)';
  context.lineWidth = 8;
  context.stroke();
  context.fillStyle = '#172326';
  context.font = seconds >= 10 ? '900 52px sans-serif' : '900 66px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(seconds), 64, 68);
  texture.needsUpdate = true;
}

function addBrick(scene, x, z, index) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const states = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const shellColor = index === 0 ? '#eceeea' : WALL_COLORS[index];
  const shellMaterial = concreteMaterial(shellColor);
  const faceMaterial = concreteMaterial(BRICK_FACE_COLORS[index]);

  function addPiece(parent, width, depth, px, pz, rotation = 0, height = 0.78, py = 0.39) {
    const pieceRoot = new THREE.Group();
    pieceRoot.position.set(px, 0, pz);
    pieceRoot.rotation.y = rotation;

    const shellGeometry = new RoundedBoxGeometry(
      width, height, depth, 4, Math.min(0.07, width * 0.12, depth * 0.12)
    );
    shellGeometry.setAttribute('uv1', shellGeometry.attributes.uv);
    randomizeUv(shellGeometry, x * 97 + z * 53 + px * 211 + pz * 307 + rotation * 41, 0.24);
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    shell.position.y = py;
    shell.castShadow = true;
    shell.receiveShadow = true;
    pieceRoot.add(shell);

    const inset = Math.min(0.08, width * 0.14, depth * 0.14);
    const faceWidth = Math.max(0.08, width - inset * 2);
    const faceDepth = Math.max(0.08, depth - inset * 2);
    const faceHeight = Math.max(0.12, height - 0.13);
    const faceGeometry = new RoundedBoxGeometry(
      faceWidth,
      faceHeight,
      faceDepth,
      4,
      Math.min(0.06, faceWidth * 0.12, faceDepth * 0.12)
    );
    faceGeometry.setAttribute('uv1', faceGeometry.attributes.uv);
    randomizeUv(faceGeometry, x * 71 + z * 89 + px * 313 + pz * 197 + rotation * 67, 0.24);
    const face = new THREE.Mesh(faceGeometry, faceMaterial);
    face.position.y = py + 0.04;
    face.castShadow = true;
    pieceRoot.add(face);
    parent.add(pieceRoot);
  }

  // State 0: a tight geometric split distinguishes breakable bricks before any hit.
  addPiece(states[0], 0.45, 0.46, -0.238, -0.235, -0.012, 0.76, 0.38);
  addPiece(states[0], 0.45, 0.46, 0.238, -0.235, 0.014, 0.78, 0.39);
  addPiece(states[0], 0.45, 0.44, -0.238, 0.245, 0.01, 0.74, 0.37);
  addPiece(states[0], 0.45, 0.44, 0.238, 0.245, -0.016, 0.8, 0.4);

  // State 1: larger gaps and uneven fragments after the first hit.
  addPiece(states[1], 0.4, 0.38, -0.24, -0.25, -0.05, 0.62, 0.31);
  addPiece(states[1], 0.36, 0.42, 0.27, -0.22, 0.08, 0.56, 0.28);
  addPiece(states[1], 0.38, 0.34, -0.25, 0.27, 0.07, 0.5, 0.25);
  addPiece(states[1], 0.34, 0.38, 0.25, 0.25, -0.09, 0.66, 0.33);
  addPiece(states[1], 0.18, 0.2, 0.01, 0.01, 0.18, 0.4, 0.2);

  // State 2: many small, displaced pieces show that the next hit will destroy it.
  addPiece(states[2], 0.28, 0.3, -0.31, -0.3, -0.12, 0.44, 0.22);
  addPiece(states[2], 0.24, 0.28, 0.02, -0.32, 0.1, 0.34, 0.17);
  addPiece(states[2], 0.25, 0.3, 0.32, -0.27, 0.16, 0.5, 0.25);
  addPiece(states[2], 0.3, 0.24, -0.3, 0.02, 0.08, 0.3, 0.15);
  addPiece(states[2], 0.2, 0.22, 0.06, 0.01, -0.18, 0.46, 0.23);
  addPiece(states[2], 0.27, 0.28, 0.32, 0.08, -0.11, 0.32, 0.16);
  addPiece(states[2], 0.3, 0.25, -0.25, 0.32, 0.14, 0.48, 0.24);
  addPiece(states[2], 0.22, 0.26, 0.1, 0.33, -0.08, 0.28, 0.14);
  addPiece(states[2], 0.16, 0.18, 0.35, 0.34, 0.2, 0.38, 0.19);

  states.forEach((state, stateIndex) => {
    state.visible = stateIndex === 0;
    root.add(state);
  });
  root.userData.states = states;
  scene.add(root);
  return root;
}

function colorIndex(cell) {
  return cell.attr >= '0' && cell.attr <= '4' ? Number(cell.attr) : 0;
}

function addSpawner(scene, x, z) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.49, 0.14, 32),
    wornMetalMaterial('#9eaa9a')
  );
  base.position.set(x, 0.08, z);
  base.castShadow = true;
  scene.add(base);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.075, 12, 32),
    wornMetalMaterial('#dfe8b8')
  );
  collar.position.set(x, 0.18, z);
  collar.rotation.x = Math.PI / 2;
  collar.castShadow = true;
  scene.add(collar);

  const throat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.18, 0.28, 32, 1, true),
    wornMetalMaterial('#293536')
  );
  throat.material.side = THREE.DoubleSide;
  throat.position.set(x, 0.24, z);
  throat.castShadow = true;
  scene.add(throat);

  const aperture = new THREE.Mesh(
    new THREE.CircleGeometry(0.225, 32),
    material('#071416', 0.92)
  );
  aperture.position.set(x, 0.385, z);
  aperture.rotation.x = -Math.PI / 2;
  scene.add(aperture);
}

function addRecessedHole(scene, x, z, index) {
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(HOLE_FUNNEL_RADIUS, 0.28, 0.42, 48, 1, true),
    holeMetalMaterial(HOLE_COLORS[index])
  );
  funnel.material.side = THREE.DoubleSide;
  funnel.position.set(x, -0.18, z);
  funnel.renderOrder = 2;
  scene.add(funnel);

  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 48),
    new THREE.MeshStandardMaterial({
      color: '#010303', roughness: 1, side: THREE.DoubleSide,
    })
  );
  bottom.position.set(x, -0.395, z);
  bottom.rotation.x = -Math.PI / 2;
  bottom.renderOrder = 3;
  scene.add(bottom);

  const glow = new THREE.PointLight(COLORS[index], 0.65, 2.4, 2);
  glow.position.set(x, -0.27, z);
  scene.add(glow);

  const rivetGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.025, 16);
  const rivetMaterial = metalMaterial('#d8dde7', 0.28, 0.86);
  [-0.75, 0.75].forEach((dx) => {
    [-0.75, 0.75].forEach((dz) => {
      const rivet = new THREE.Mesh(rivetGeometry, rivetMaterial);
      rivet.position.set(x + dx, 0.025, z + dz);
      rivet.castShadow = true;
      scene.add(rivet);
    });
  });

  const cover = new THREE.Group();
  cover.position.set(x, 0.045, z);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(HOLE_FUNNEL_RADIUS * 0.98, HOLE_FUNNEL_RADIUS * 0.98, 0.07, 48),
    holeMetalMaterial('#656f72')
  );
  lid.castShadow = true;
  cover.add(lid);
  [-0.28, 0, 0.28].forEach((offset) => {
    const bar = new THREE.Mesh(
      new RoundedBoxGeometry(HOLE_FUNNEL_RADIUS * 1.65, 0.06, 0.08, 3, 0.025),
      holeMetalMaterial('#c9d0d2')
    );
    bar.position.set(0, 0.07, offset);
    bar.castShadow = true;
    cover.add(bar);
  });
  cover.visible = false;
  scene.add(cover);
  return cover;
}

function directionRotation(direction) {
  if (direction === 'D') return Math.PI;
  if (direction === 'L') return Math.PI / 2;
  if (direction === 'R') return -Math.PI / 2;
  return 0;
}

function arrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.36);
  shape.lineTo(0.3, 0.05);
  shape.lineTo(0.12, 0.05);
  shape.lineTo(0.12, -0.34);
  shape.lineTo(-0.12, -0.34);
  shape.lineTo(-0.12, 0.05);
  shape.lineTo(-0.3, 0.05);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function chevronGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, -0.12);
  shape.lineTo(0, 0.2);
  shape.lineTo(0.32, -0.12);
  shape.lineTo(0.2, -0.24);
  shape.lineTo(0, -0.04);
  shape.lineTo(-0.2, -0.24);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function addDirectionArrow(scene, x, y, z, direction, color, scale = 1) {
  const arrow = new THREE.Mesh(
    arrowGeometry(),
    new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4,
      side: THREE.DoubleSide,
    })
  );
  arrow.position.set(x, y, z);
  arrow.rotation.x = -Math.PI / 2;
  arrow.rotation.z = directionRotation(direction);
  arrow.scale.setScalar(scale);
  arrow.castShadow = true;
  scene.add(arrow);
}

function addColorGate(scene, x, z, index) {
  const color = GLASS_COLORS[index];
  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.76, 0.82),
    new THREE.MeshPhysicalMaterial({
      color, transparent: true, opacity: 0.4, roughness: 0.24,
      metalness: 0.06, transmission: 0.12, depthWrite: false,
    })
  );
  gate.position.set(x, 0.38, z);
  gate.castShadow = true;
  scene.add(gate);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(gate.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  edges.position.copy(gate.position);
  scene.add(edges);
}

function addOneWayWall(scene, x, z, direction, index) {
  const color = GLASS_COLORS[index];
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.68, 0.86),
    new THREE.MeshStandardMaterial({
      color, transparent: true, opacity: 0.66, roughness: 0.5, depthWrite: false,
    })
  );
  wall.position.set(x, 0.34, z);
  wall.castShadow = true;
  scene.add(wall);
  addDirectionArrow(scene, x, 0.695, z, direction, '#ffffff', 0.82);
}

function addAccelerator(scene, x, z, direction) {
  const frame = new THREE.Mesh(
    new RoundedBoxGeometry(0.92, 0.035, 0.92, 4, 0.045),
    metalMaterial('#e0deec', 0.34, 0.46)
  );
  frame.position.set(x, -0.012, z);
  frame.receiveShadow = true;
  scene.add(frame);

  const inset = new THREE.Mesh(
    new RoundedBoxGeometry(0.76, 0.014, 0.76, 4, 0.035),
    metalMaterial('#d4d1e2', 0.5, 0.18)
  );
  inset.position.set(x, 0.012, z);
  inset.receiveShadow = true;
  scene.add(inset);

  const vectors = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  const [dx, dz] = vectors[direction] || vectors.U;
  [-0.19, 0.19].forEach((offset) => {
    const chevron = new THREE.Mesh(
      chevronGeometry(),
      new THREE.MeshStandardMaterial({ color: '#aaa7c1', roughness: 0.48, metalness: 0.08, side: THREE.DoubleSide })
    );
    chevron.position.set(x + dx * offset, 0.021, z + dz * offset);
    chevron.rotation.x = -Math.PI / 2;
    chevron.rotation.z = directionRotation(direction);
    chevron.scale.setScalar(0.62);
    scene.add(chevron);
  });
}

function formatRecordTime(seconds) {
  if (seconds == null) return '-';
  const value = Number(seconds);
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

// Parking a warmed preview must explicitly stop rendering: display:none alone
// does not suspend animation frames in every browser.
function createPreviewLoop(render, win = window) {
  let active = true, started = false, frame = null;
  function schedule() {
    if (active && started && frame === null) frame = win.requestAnimationFrame(previewFrame);
  }
  function previewFrame(now) {
    frame = null;
    if (!active) return;
    render(now);
    schedule();
  }
  return {
    start() { started = true; schedule(); },
    setActive(next) {
      active = Boolean(next);
      if (!active && frame !== null) { win.cancelAnimationFrame(frame); frame = null; }
      schedule();
    },
  };
}

async function main() {
  if (!BOOT_NODE || !ROOT || !CANVAS || !window.Inkball?.Level) return;
  const pageData = JSON.parse(BOOT_NODE.textContent);
  const boot = pageData.selected;
  const urlParams = new URLSearchParams(window.location.search);
  const playMode = urlParams.get('mode') === 'play';
  const embeddedPlayMode = urlParams.get('mode') === 'embedded-play';
  const backgroundMode = urlParams.get('mode') === 'background';
  const autoStartMode = playMode || embeddedPlayMode;
  let directPlayMode = autoStartMode && (!boot.community || Boolean(boot.communityRun));
  ROOT.classList.toggle('is-play-mode', autoStartMode);
  ROOT.classList.toggle('is-embedded-play-mode', embeddedPlayMode);
  ROOT.classList.toggle('is-background-mode', backgroundMode);
  const picker = document.querySelector('[data-level-picker]');
  const mapSelect = picker?.querySelector('[data-map-select]');
  const difficultySelect = picker?.querySelector('[data-difficulty-select]');
  const title = document.querySelector('[data-prototype-map-title]');
  const subtitle = document.querySelector('[data-prototype-map-subtitle]');
  if (title) title.textContent = boot.map_name || boot.name || 'Inkball';
  if (subtitle) subtitle.textContent = boot.difficulty_label || boot.difficulty || '';
  function fillDifficulties(mapSlug, preferredDifficulty) {
    if (!difficultySelect) return;
    const map = pageData.catalog.find((entry) => entry.slug === mapSlug) || pageData.catalog[0];
    difficultySelect.replaceChildren();
    map?.levels.forEach((entry) => {
      difficultySelect.add(new Option(entry.label, entry.difficulty, false, entry.difficulty === preferredDifficulty));
    });
  }
  if (mapSelect && difficultySelect) {
    pageData.catalog.forEach((entry) => {
      mapSelect.add(new Option(entry.name, entry.slug, false, entry.slug === boot.map));
    });
    fillDifficulties(boot.map, boot.difficulty);
    mapSelect.addEventListener('change', () => fillDifficulties(mapSelect.value));
    picker.addEventListener('submit', (event) => {
      event.preventDefault();
      const params = new URLSearchParams({ map: mapSelect.value, difficulty: difficultySelect.value });
      if (boot.personalMap) params.set('personal', '1');
      window.location.assign(`${window.location.pathname}?${params}`);
    });
  }
  let cells = parseLayout(boot.layout);
  const scene = new THREE.Scene();
  scene.background = backgroundMode ? null : new THREE.Color('#1c3a3e');
  scene.fog = new THREE.Fog(AMBIENT_FOG_COLOR, 30, 105);

  const renderer = new THREE.WebGLRenderer({ canvas: CANVAS, antialias: true, alpha: backgroundMode });
  ROOT.dataset.rendererStage = 'scene';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER_PIXEL_RATIO_CAP));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  [gridTexture, metalNormal, metalRoughness, metalnessMap].forEach((texture) => {
    texture.anisotropy = Math.min(8, maxAnisotropy);
  });
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  scene.environment = environmentGenerator.fromScene(roomEnvironment, 0.04).texture;
  roomEnvironment.dispose();
  environmentGenerator.dispose();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 170);
  camera.position.copy(PREVIEW_CAMERA_POSITION);
  const controls = new OrbitControls(camera, CANVAS);
  controls.enableDamping = true;
  controls.target.copy(PREVIEW_CAMERA_TARGET);
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 10;
  controls.maxDistance = 34;

  scene.add(new THREE.HemisphereLight('#effff6', '#355057', 2.05));
  scene.add(new THREE.AmbientLight('#ffffff', 0.28));
  const sun = new THREE.DirectionalLight('#fff8df', 3.15);
  sun.position.set(-5, 13, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  scene.add(sun);
  const ambientBlockField = createAmbientBlockField(scene, !backgroundMode && !embeddedPlayMode);

  const tileGeometry = new THREE.BoxGeometry(0.96, 0.16, 0.96);
  tileGeometry.setAttribute('uv1', tileGeometry.attributes.uv);
  const tileGeometries = Array.from({ length: 12 }, (_, index) => {
    const geometry = tileGeometry.clone();
    return randomizeUv(geometry, 1000 + index * 37, 0.34);
  });
  const holeTileGeometry = carvedHoleTileGeometry();
  const tileMaterial = floorMaterial();
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);
  const brickVisuals = new Map();
  const keyWallVisuals = new Map();
  const holeCovers = new Map();
  const timedWallVisuals = new Map();

  function describeCells(parsed) {
    const holes = new Map();
    parsed.forEach((line, y) => line.forEach((cell, x) => {
      if (cell.token !== 'H') return;
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
        holes.set(`${x + dx},${y + dy}`, { x, y, index: colorIndex(cell) });
      }
    }));
    return parsed.flatMap((line, y) => line.map((cell, x) => {
      const footprint = holes.get(`${x},${y}`);
      // Placed balls have separate meshes; their changes leave the floor still.
      const token = cell.token === 'B' ? ' ' : cell.token;
      const attr = token === ' ' ? ' ' : cell.attr;
      return { key: `${x},${y}`, x, y, cell, footprint,
        signature: `${token}:${attr}:${footprint ? `${footprint.x},${footprint.y},${footprint.index}` : ''}` };
    }));
  }

  function createCell(row) {
    const group = new THREE.Group();
    group.position.set(worldXFromCell(row.x), 0, worldZFromCell(row.y));
    boardGroup.add(group);
    const { cell, x, y, footprint: holeFootprint } = row;
    const packed = Inkball.unpackColorCell && Inkball.unpackColorCell(cell.token);
    const token = packed ? packed.token : cell.token;
    const specialColor = packed ? packed.color : colorIndex(cell);
    const wx = 0, wz = 0;
    if (holeFootprint) {
      if (holeFootprint.x === x && holeFootprint.y === y) {
        addCarvedHoleTile(
          group,
          holeTileGeometry,
          holeMetalMaterial(HOLE_COLORS[holeFootprint.index]),
          wx + 0.5,
          wz + 0.5
        );
      }
    } else {
      const variant = Math.floor(seededUnit(x * 97 + y * 193) * tileGeometries.length);
      box(group, tileGeometries[variant], tileMaterial, wx, -0.08, wz);
    }
    if (token === 'X' || (token >= '1' && token <= '4')) {
      const index = token === 'X' ? 0 : Number(token);
      addWall(group, wx, wz, index);
    } else if (token === 'S') {
      addSpawner(group, wx, wz);
    } else if (token === 'H') {
      group.userData.hole = addRecessedHole(group, wx + 0.5, wz + 0.5, specialColor);
    } else if (token === 'C') {
      addColorGate(group, wx, wz, specialColor);
    } else if ('UDLR'.includes(token)) {
      addOneWayWall(group, wx, wz, token, specialColor);
    } else if ('udlr'.includes(token)) {
      addAccelerator(group, wx, wz, token.toUpperCase());
    } else if (token === 'A' && 'udlr'.includes(cell.attr.toLowerCase())) {
      addAccelerator(group, wx, wz, cell.attr.toUpperCase());
    } else if (token === 'K') {
      group.userData.brick = addBrick(group, wx, wz, specialColor);
    } else if (token === 'Y') {
      group.userData.keyWall = addKeyWall(group, wx, wz, specialColor);
    } else if (token === 'V' || token === 'G') {
      addMechanismSwitch(group, wx, wz, specialColor, token);
    } else if (token === 'T') {
      group.userData.timed = addTimedWall(group, wx, wz);
    }

    return group;
  }

  const sharedGeometry = new Set(tileGeometries.concat([holeTileGeometry]));
  function removeCell(group) {
    boardGroup.remove(group);
    const disposed = new Set();
    group.traverse(child => {
      if (child.geometry && !sharedGeometry.has(child.geometry) && !sharedWallGeometry.has(child.geometry) && !disposed.has(child.geometry)) {
        child.geometry.dispose(); disposed.add(child.geometry);
      }
      const materials = child.material ? [].concat(child.material) : [];
      materials.forEach(value => {
        if (value === tileMaterial || disposed.has(value)) return;
        if (value.map instanceof THREE.CanvasTexture && !disposed.has(value.map)) {
          value.map.dispose(); disposed.add(value.map);
        }
        value.dispose(); disposed.add(value);
      });
    });
  }
  const cellMorph = window.InkballRenderPreview.reconcile({ create: createCell, remove: removeCell, now: () => performance.now() });
  function rebuildBoard(animate) {
    const groups = cellMorph.update(describeCells(cells), animate);
    [brickVisuals, keyWallVisuals, holeCovers, timedWallVisuals].forEach(map => map.clear());
    groups.forEach((entry, key) => {
      const data = entry.node.userData;
      if (data.brick) brickVisuals.set(key, data.brick);
      if (data.keyWall) keyWallVisuals.set(key, data.keyWall);
      if (data.hole) holeCovers.set(key, data.hole);
      if (data.timed) timedWallVisuals.set(key, data.timed);
    });
  }
  rebuildBoard(false);

  const app = {
    isLevelEnded: false, isGameEnded: false, score: 0, correctCaptures: 0, wrongCaptures: 0,
    config: {
      score_increase_from_hole_capture: { grey: 70, orange: 100, blue: 100, green: 100, yellow: 100 },
      score_decrease_from_wrong_hole: { grey: 0, orange: 25, blue: 25, green: 25, yellow: 25 },
    },
    dashboard: { onBallSpawned() {}, onBallsYetToSpawnChanged() {} },
    ballImages: [], holeImages: [], wallImages: [], brickImages: [], oneWayImages: {}, acceleratorImages: {},
  };
  let levelConfig = boot.config;
  let level = new Inkball.Level(app, levelConfig, boot.layout);

  function syncBrickVisuals() {
    brickVisuals.forEach((visual, key) => {
      const [x, y] = key.split(',').map(Number);
      const tile = level.tileAt[y] && level.tileAt[y][x];
      visual.visible = tile instanceof Inkball.BrickTile && !tile.removed;
      if (!visual.visible) return;
      const stateIndex = Math.min(tile.hits, visual.userData.states.length - 1);
      visual.userData.states.forEach((state, stateIndexCandidate) => {
        state.visible = stateIndexCandidate === stateIndex;
      });
    });
  }

  function syncMechanismVisuals() {
    keyWallVisuals.forEach((visual, key) => {
      const [x, y] = key.split(',').map(Number);
      const tile = level.tileAt[y] && level.tileAt[y][x];
      const isSolid = tile instanceof Inkball.KeyWallTile && tile.solid;
      visual.userData.solid.visible = isSolid;
      visual.userData.passable.visible = !isSolid;
    });
    level.holes.forEach((hole) => {
      const gx = Math.round(hole.x / Inkball.CELLSIZE);
      const gy = Math.round((hole.y - Inkball.TOP_OFFSET) / Inkball.CELLSIZE);
      const cover = holeCovers.get(`${gx},${gy}`);
      if (cover) cover.visible = hole.disabled;
    });
    timedWallVisuals.forEach((visual, key) => {
      const [x, y] = key.split(',').map(Number);
      const tile = level.tileAt[y] && level.tileAt[y][x];
      visual.visible = tile instanceof Inkball.TimedTile && !tile.removed;
      if (!visual.visible) return;
      updateTimedWallLabel(visual, Math.max(1, Math.ceil(tile.lifetime)));
      const opacity = Math.max(0.28, tile.lifetime / tile.maxLifetime);
      visual.traverse((child) => {
        if (!child.material) return;
        const hasTransparentTexture = Boolean(child.material.map);
        child.material.transparent = hasTransparentTexture || opacity < 0.99;
        child.material.opacity = opacity;
        child.material.depthWrite = !hasTransparentTexture && opacity >= 0.99;
      });
    });
  }
  let cameraMode = 'orbit';
  let cameraLocked = false;
  const ballMeshes = new Map();
  const lineGroup = new THREE.Group();
  boardGroup.add(lineGroup);
  const ballGeometry = new THREE.SphereGeometry(0.31, 28, 20);
  const ballMaterials = BALL_COLORS.map((color) => new THREE.MeshMatcapMaterial({
    color,
    matcap: ballMatcap,
  }));
  const inkMaterial = new THREE.MeshStandardMaterial({
    color: '#0f4c47',
    emissive: '#04211f',
    emissiveIntensity: 0.18,
    roughness: 0.16,
    metalness: 0.92,
    envMapIntensity: 1.7,
  });
  inkMaterial.normalMap = metalNormal;
  inkMaterial.normalScale.set(0.08, 0.08);
  inkMaterial.roughnessMap = metalRoughness;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const drawingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);
  let drawingLine = null;
  let drawingPointerId = null;
  let erasePointerId = null;
  let drawTool = 'draw';
  const activePointers = new Map();
  let pinchState = null;
  let renderedLineSignature = null;
  let renderedQueueSignature = null;
  let resultShown = false;
  let gameStarted = false;
  let isPaused = false;
  let playStartedAt = 0;
  let startPending = false;
  let pendingResult = null;
  let completionFailed = false;
  const exitRun = window.InkballRunExit(() => (
    gameStarted && (!resultShown || completionFailed) ? boot.communityRun : ''
  ), () => (
    gameStarted && (!resultShown || completionFailed) ? boot.sessionId : null
  ));
  let lastTime = performance.now();
  let readyPosted = false;
  let cameraTransition = null;
  let previewRequest = 0;
  let readyRequest = 0;
  let previewDepth = backgroundMode && urlParams.get('preview') === 'flat' ? 0 : 1;
  let previewMorph = null;
  let previewRect = null;
  let animateNewBalls = false;
  const retiringBalls = [];

  function applyPreviewPose() {
    const width = Math.max(1, CANVAS.clientWidth || window.innerWidth);
    const height = Math.max(1, CANVAS.clientHeight || window.innerHeight);
    const rect = previewRect || { left: (width - Math.min(576, width)) / 2,
      top: (height - Math.min(576, width)) / 2, width: Math.min(576, width), height: Math.min(576, width) };
    const boardHeight = Math.max(1, Math.min(rect.width, rect.height));
    const distance = 9 * height / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * boardHeight);
    camera.far = Math.max(100, distance * 1.5);
    camera.position.set(0, distance, 0.001).lerp(PREVIEW_CAMERA_POSITION, previewDepth);
    controls.target.set(0, 0, 0).lerp(PREVIEW_CAMERA_TARGET, previewDepth);
    const offsetX = (width / 2 - (rect.left + rect.width / 2)) * (1 - previewDepth);
    const offsetY = (height / 2 - (rect.top + rect.height / 2)) * (1 - previewDepth);
    camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    boardGroup.scale.y = 0.025 + 0.975 * previewDepth;
    camera.lookAt(controls.target);
  }

  function morphPreview(data) {
    if (!backgroundMode || gameStarted) return;
    previewRect = data.rect || previewRect;
    cameraTransition = null;
    const target = data.mode === '2d' ? 0 : 1;
    const duration = Number(data.duration) || 0;
    if (!previewMorph && previewDepth === target) {
      if (target === 0) applyPreviewPose();
      return;
    }
    controls.enabled = false;
    if (duration <= 0) {
      previewDepth = target; previewMorph = null;
      applyPreviewPose();
      controls.enabled = target === 1;
      return;
    }
    previewMorph = { start: performance.now(), from: previewDepth, to: target, duration };
  }

  function updatePreviewMorph(now) {
    if (!backgroundMode || gameStarted) return false;
    if (!previewMorph && previewDepth === 1) return false;
    if (previewMorph) {
      const progress = Math.min(1, Math.max(0, (now - previewMorph.start) / previewMorph.duration));
      previewDepth = previewMorph.from + (previewMorph.to - previewMorph.from) * (1 - Math.pow(1 - progress, 3));
      if (progress === 1) { previewMorph = null; controls.enabled = previewDepth === 1; }
    }
    applyPreviewPose();
    return true;
  }

  function reconcileBalls(nextLevel) {
    const keyOf = model => `${model.colorIndex}:${model.x}:${model.y}:${model.size}`;
    const previous = new Map();
    ballMeshes.forEach((mesh, model) => {
      const key = keyOf(model);
      if (!previous.has(key)) previous.set(key, []);
      previous.get(key).push(mesh);
    });
    ballMeshes.clear();
    nextLevel.ballsInGame.forEach(model => {
      const matching = previous.get(keyOf(model));
      if (matching && matching.length) ballMeshes.set(model, matching.pop());
    });
    previous.forEach(meshes => meshes.forEach(mesh => {
      retiringBalls.push({ mesh, start: performance.now(), scale: mesh.scale.x });
    }));
    animateNewBalls = true;
  }

  function updateBallMorph(now) {
    for (let index = retiringBalls.length - 1; index >= 0; index -= 1) {
      const row = retiringBalls[index];
      const progress = Math.min(1, (now - row.start) / 420);
      row.mesh.scale.setScalar(Math.max(0.001, row.scale * Math.pow(1 - progress, 3)));
      if (progress === 1) { boardGroup.remove(row.mesh); retiringBalls.splice(index, 1); }
    }
    if (gameStarted) return;
    ballMeshes.forEach(mesh => {
      if (mesh.userData.previewBornAt == null) return;
      const progress = Math.min(1, (now - mesh.userData.previewBornAt) / 420);
      mesh.scale.multiplyScalar(Math.max(0.001, 1 - Math.pow(1 - progress, 3)));
      if (progress === 1) delete mesh.userData.previewBornAt;
    });
  }

  async function updatePreview(data) {
    if (!backgroundMode || gameStarted || data.map !== boot.map) return;
    const request = Number(data.request);
    if (!Number.isInteger(request) || request <= previewRequest) return;
    previewRequest = request;
    try {
      const next = data.selected;
      if (!next) throw new Error('Preview unavailable.');
      if (request !== previewRequest) return;
      if (next.map !== boot.map || next.difficulty !== data.difficulty ||
          !!next.personalMap !== !!boot.personalMap || !!next.community !== !!boot.community) {
        throw new Error('Preview does not match this map.');
      }
      const nextCells = parseLayout(next.layout);
      const nextLevel = new Inkball.Level(app, next.config, next.layout);
      cells = nextCells;
      Object.assign(boot, next);
      levelConfig = boot.config;
      if (data.reducedMotion) {
        retiringBalls.splice(0).forEach(row => boardGroup.remove(row.mesh));
        animateNewBalls = false;
        ballMeshes.forEach(mesh => boardGroup.remove(mesh)); ballMeshes.clear();
      } else reconcileBalls(nextLevel);
      level = nextLevel;
      rebuildBoard(!data.reducedMotion);
      if (title) title.textContent = boot.map_name;
      if (subtitle) subtitle.textContent = boot.difficulty_label;
      renderedQueueSignature = null;
      readyRequest = request;
      readyPosted = false;
      // A hidden/occluded WKWebView may defer its next animation frame.
      animate(performance.now());
    } catch (error) {
      if (request !== previewRequest) return;
      window.parent.postMessage({ type: 'inkball:3d-preview-error', session: window.INKBALL_3D_SESSION, message: error.message, map: boot.map, request }, '*');
    }
  }

  function syncAmbientBlockField() {
    if (!ambientBlockField) return;
    ambientBlockField.root.visible = !backgroundMode && !embeddedPlayMode;
  }

  function cameraPose(mode) {
    return mode === 'play'
      ? { position: PLAY_CAMERA_POSITION, target: PLAY_CAMERA_TARGET }
      : { position: PREVIEW_CAMERA_POSITION, target: PREVIEW_CAMERA_TARGET };
  }

  function setCameraPose(mode, animate = false) {
    const pose = cameraPose(mode);
    cameraTransition = null;
    if (!animate) {
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      return;
    }
    cameraTransition = {
      startedAt: performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: pose.position.clone(),
      toTarget: pose.target.clone(),
    };
  }

  function updateCameraTransition(now) {
    if (!cameraTransition) return false;
    const progress = Math.min(1, (now - cameraTransition.startedAt) / CAMERA_ZOOM_DURATION_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.copy(cameraTransition.fromPosition).lerp(cameraTransition.toPosition, eased);
    controls.target.copy(cameraTransition.fromTarget).lerp(cameraTransition.toTarget, eased);
    if (progress >= 1) cameraTransition = null;
    return true;
  }

  function renderLeaderboard(rows) {
    const body = document.querySelector('[data-prototype-leaderboard]');
    if (!body) return;
    body.replaceChildren();
    if (!rows || !rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.textContent = 'No records yet.';
      tr.append(td);
      body.append(tr);
      return;
    }
    rows.slice(0, 4).forEach((row) => {
      const tr = document.createElement('tr');
      [row.rank, row.nickname, `${row.accuracy}%`, row.score].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = String(value);
        tr.append(td);
      });
      body.append(tr);
    });
  }

  function renderRecords(payload) {
    const best = payload && payload.best;
    const clearNode = document.querySelector('[data-record-clears]');
    const score = document.querySelector('[data-record-score]');
    const time = document.querySelector('[data-record-time]');
    const accuracy = document.querySelector('[data-record-accuracy]');
    if (score) score.textContent = best ? String(best.score) : '-';
    if (time) time.textContent = best ? formatRecordTime(best.time) : '-';
    if (accuracy) accuracy.textContent = best ? `${best.accuracy}%` : '-';
    if (clearNode) clearNode.textContent = best ? String(best.clears ?? payload.clears ?? 0) : '-';
  }

  function renderAchievements(rows) {
    const root = document.querySelector('[data-prototype-achievements]');
    if (!root) return;
    root.replaceChildren();
    if (!rows || !rows.length) {
      root.textContent = 'No achievements.';
      return;
    }
    rows.slice(0, 3).forEach((row) => {
      const item = document.createElement('div');
      item.className = 'prototype3d__achievement';
      const titleNode = document.createElement('strong');
      titleNode.textContent = row.name || row.name_zh || row.code;
      const condition = document.createElement('small');
      condition.textContent = row.unlocked ? 'Unlocked' : 'Locked';
      item.append(titleNode, condition);
      root.append(item);
    });
  }

  function loadBriefing() {
    if (boot.personalMap) {
      renderLeaderboard([]);
      renderRecords(boot.records);
      renderAchievements([]);
      return;
    }
    if (!window.InkballApi || !window.INKBALL_API || !boot.map || !boot.difficulty) return;
    const base = INKBALL_API.mapUrl(boot.map);
    const query = `?difficulty=${encodeURIComponent(boot.difficulty)}`;
    InkballApi.get(`${base}leaderboard/${query}`)
      .then((payload) => renderLeaderboard(payload && payload.results))
      .catch(() => renderLeaderboard([]));
    InkballApi.get(`${base}records/${query}`)
      .then(renderRecords)
      .catch(() => renderRecords(null));
    InkballApi.get(`${base}achievements/${query}`)
      .then((payload) => renderAchievements(payload && payload.achievements))
      .catch(() => renderAchievements([]));
  }

  function renderDashboard() {
    if (SCORE_NODE) SCORE_NODE.textContent = String(app.score);
    if (TIME_NODE) TIME_NODE.textContent = level.levelTimer >= 0 ? String(Math.max(0, Math.ceil(level.levelTimer))) : '∞';
    if (NEXT_NODE) NEXT_NODE.textContent = level.ballsYetToSpawn.length ? `${Math.max(0, level.spawnTimer).toFixed(1)}s` : '—';
    const visibleBalls = level.ballsYetToSpawn.slice(0, MAX_VISIBLE_QUEUED_BALLS);
    const signature = visibleBalls.join(',');
    if (QUEUE_NODE && signature !== renderedQueueSignature) {
      renderedQueueSignature = signature;
      QUEUE_NODE.replaceChildren();
      visibleBalls.forEach((color) => {
        const ball = document.createElement('span');
        ball.className = 'prototype3d__queue-ball';
        ball.style.setProperty('--ball-color', COLORS[level.colorStringToIndex(color)] || COLORS[0]);
        ball.title = color;
        QUEUE_NODE.append(ball);
      });
    }
  }

  function showResult() {
    if (!RESULT || resultShown) return;
    resultShown = true;
    const attempts = app.correctCaptures + app.wrongCaptures;
    const accuracy = attempts ? Math.round((app.correctCaptures / attempts) * 100) : 0;
    RESULT.querySelector('[data-prototype-result-map]').textContent = `${boot.map_name} · ${boot.difficulty_label}`;
    RESULT.querySelector('[data-prototype-result-title]').textContent = level.timeUp ? 'Time up' : 'Level complete';
    RESULT.querySelector('[data-result-score]').textContent = String(app.score);
    RESULT.querySelector('[data-result-captured]').textContent = String(app.correctCaptures);
    RESULT.querySelector('[data-result-wrong]').textContent = String(app.wrongCaptures);
    RESULT.querySelector('[data-result-accuracy]').textContent = `${accuracy}%`;
    RESULT.hidden = false;
  }

  function resultParams(extra, cleared, duration, accuracy) {
    extra = extra || {};
    const previousBest =
      extra.previous_best == null || extra.previous_best === ''
        ? null
        : Number(extra.previous_best);
    const isNewRecord = !!extra.new_record && (previousBest == null || app.score > previousBest);
    const params = {
      difficulty: boot.difficulty,
      cleared: cleared ? '1' : '0',
      score: String(app.score),
      time: String(duration),
      accuracy: String(accuracy),
      correct: String(app.correctCaptures || 0),
      wrong: String(app.wrongCaptures || 0),
      best: String(extra.best_score != null ? extra.best_score : app.score),
      new_record: isNewRecord ? '1' : '0',
      mode: '3d',
    };
    if (extra.previous_best != null && extra.previous_best !== '') {
      params.prev_best = String(extra.previous_best);
    }
    return params;
  }

  function goToResult(extra, cleared, duration, accuracy) {
    const base = boot.result_url || `/maps/${encodeURIComponent(boot.map)}/result/`;
    const query = new URLSearchParams(resultParams(extra, cleared, duration, accuracy)).toString();
    const separator = base.indexOf('?') === -1 ? '?' : '&';
    let dest = `${base}${separator}${query}`;
    if (window.InkballTabSession && InkballTabSession.withTab) {
      dest = InkballTabSession.withTab(dest);
    }
    if (window.InkballScene) window.InkballScene.navigate(dest);
    else window.location.href = dest;
  }

  function finishAttempt() {
    if (resultShown) return;
    isPaused = false;
    syncPauseUi();
    resultShown = true;
    const cleared = !level.timeUp;
    const duration = pendingResult ? pendingResult.duration_seconds
      : Math.max(0, Math.round((Date.now() - (playStartedAt || Date.now())) / 1000));
    const correct = app.correctCaptures || 0;
    const wrong = app.wrongCaptures || 0;
    const total = correct + wrong;
    const accuracy = total ? Math.round((100 * correct) / total) : 0;
    const payload = pendingResult || {
      map: boot.map,
      difficulty: boot.difficulty,
      status: cleared ? 'completed' : 'failed',
      score: app.score,
      duration_seconds: duration,
      correct_captures: correct,
      wrong_captures: wrong,
      lines_drawn: app.linesDrawn || 0,
    };
    if (boot.personalMap) payload.personal_map = true;
    if (boot.sessionId) payload.session_id = boot.sessionId;
    pendingResult = payload;
    const saveResult = boot.communityRun && window.InkballApi && window.INKBALL_API &&
      typeof INKBALL_API.communityRunCompleteUrl === 'function'
      ? InkballApi.post(INKBALL_API.communityRunCompleteUrl(boot.communityRun), payload)
      : (
        boot.authenticated && window.InkballApi && window.INKBALL_API && INKBALL_API.sessions
          ? InkballApi.post(INKBALL_API.sessions, payload)
          : Promise.resolve({})
      );
    saveResult.then((extra) => {
      if (boot.communityRun && boot.result_url) {
        if (window.InkballScene) window.InkballScene.navigate(boot.result_url);
        else window.location.href = boot.result_url;
        return;
      }
      goToResult(extra, cleared, duration, accuracy);
    }).catch(() => {
      if (boot.communityRun || boot.sessionId) {
        completionFailed = true;
        resultShown = false;
        showResult();
        const error = RESULT && RESULT.querySelector('[data-prototype-save-error]');
        const retry = RESULT && RESULT.querySelector('[data-result-save-retry]');
        if (error) error.hidden = false;
        if (retry) retry.hidden = false;
        return;
      }
      goToResult({}, cleared, duration, accuracy);
    });
  }

  function clearObject(object) {
    while (object.children.length) {
      const child = object.children.pop();
      if (child.geometry) child.geometry.dispose();
    }
  }

  function lineTubeGeometry(points) {
    const vectors = points.map((point) => (
      new THREE.Vector3(worldXFromPixel(point.x), 0.24, worldZFromPixel(point.y))
    ));
    const filtered = [];
    vectors.forEach((point) => {
      const previous = filtered[filtered.length - 1];
      if (!previous || previous.distanceToSquared(point) > 0.0001) filtered.push(point);
    });
    if (filtered.length < 2) return null;
    let totalLength = 0;
    for (let i = 1; i < filtered.length; i += 1) {
      totalLength += filtered[i - 1].distanceTo(filtered[i]);
    }
    const path = filtered.length === 2
      ? new THREE.LineCurve3(filtered[0], filtered[1])
      : new THREE.CatmullRomCurve3(filtered, false, 'centripetal', 0.42);
    const tubularSegments = THREE.MathUtils.clamp(Math.ceil(totalLength * 12), 12, 140);
    return new THREE.TubeGeometry(path, tubularSegments, 0.082, 18, false);
  }

  function inkMesh(points) {
    const geometry = lineTubeGeometry(points);
    if (!geometry) return null;
    const tube = new THREE.Mesh(geometry, inkMaterial);
    tube.castShadow = true;
    return tube;
  }

  async function warmDrawingResources() {
    // Empty previews otherwise omit inkMaterial from shader compilation. Exercise
    // both tube paths and the real color/shadow passes before announcing ready.
    const warmup = new THREE.Group();
    warmup.add(inkMesh([{ x: 256, y: 320 }, { x: 288, y: 352 }]));
    warmup.add(inkMesh([{ x: 256, y: 320 }, { x: 288, y: 352 }, { x: 304, y: 352 }]));
    boardGroup.add(warmup);
    try {
      await renderer.compileAsync(scene, camera);
      renderer.render(scene, camera);
    } finally {
      boardGroup.remove(warmup);
      warmup.children.forEach(tube => tube.geometry.dispose());
    }
    // The next synchronous render replaces the sample frame. No sample enters
    // level.lines, scores, stroke counts or the visible preview.
  }

  function rebuildLines() {
    const renderLines = drawingLine ? level.lines.concat([drawingLine]) : level.lines;
    const signature = renderLines
      .map((line, index) => `${index}:${line.points.map((p) => `${p.x | 0},${p.y | 0}`).join(':')}`)
      .join('|');
    if (signature === renderedLineSignature) return;
    renderedLineSignature = signature;
    clearObject(lineGroup);
    renderLines.forEach((line) => {
      const tube = inkMesh(line.getPoints());
      if (tube) lineGroup.add(tube);
    });
  }

  function invalidateLineRender() {
    renderedLineSignature = null;
  }

  function syncBalls() {
    const active = new Set(level.ballsInGame);
    ballMeshes.forEach((mesh, model) => {
      if (!active.has(model)) {
        boardGroup.remove(mesh);
        ballMeshes.delete(model);
      }
    });
    level.ballsInGame.forEach((model) => {
      let mesh = ballMeshes.get(model);
      if (!mesh) {
        mesh = new THREE.Mesh(ballGeometry, ballMaterials[model.colorIndex] || ballMaterials[0]);
        mesh.castShadow = true;
        boardGroup.add(mesh);
        ballMeshes.set(model, mesh);
        if (animateNewBalls && !gameStarted) mesh.userData.previewBornAt = performance.now();
      }
      const captureScale = Math.max(0.08, model.size / 20);
      const ballY = model._inHolePull ? 0.34 * captureScale - 0.18 * (1 - captureScale) : 0.34;
      mesh.position.set(
        worldXFromPixel(model.x + model.size / 2), ballY,
        worldZFromPixel(model.y + model.size / 2)
      );
      mesh.scale.setScalar(captureScale);
      mesh.material = ballMaterials[model.colorIndex] || ballMaterials[0];
      mesh.rotation.x += model.vy * 0.0008;
      mesh.rotation.z -= model.vx * 0.0008;
    });
    animateNewBalls = false;
  }

  function boardPoint(event) {
    const rect = CANVAS.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(drawingPlane, hit) ? pixelFromWorld(hit) : null;
  }

  function validDrawPoint(point) {
    return point && point.x >= Inkball.DRAW_AREA_X_MIN && point.x <= Inkball.DRAW_AREA_X_MAX &&
      point.y >= Inkball.DRAW_AREA_Y_MIN && point.y <= Inkball.DRAW_AREA_Y_MAX;
  }

  function activeTouchPoints() {
    return Array.from(activePointers.values()).filter((point) => point.pointerType === 'touch');
  }

  function touchDistance(points) {
    if (points.length < 2) return 0;
    return Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
  }

  function beginPinchZoom() {
    const points = activeTouchPoints();
    if (cameraLocked || points.length < 2) return;
    const distance = touchDistance(points);
    if (distance <= 0) return;
    pinchState = {
      screenDistance: distance,
      cameraDistance: camera.position.distanceTo(controls.target),
      direction: camera.position.clone().sub(controls.target).normalize(),
    };
    controls.enabled = false;
  }

  function updatePinchZoom() {
    if (cameraLocked || !pinchState) return;
    const points = activeTouchPoints();
    const distance = touchDistance(points);
    if (distance <= 0) return;
    const scale = distance / pinchState.screenDistance;
    const nextDistance = THREE.MathUtils.clamp(
      pinchState.cameraDistance / Math.max(0.2, scale),
      controls.minDistance,
      controls.maxDistance
    );
    camera.position.copy(controls.target).addScaledVector(pinchState.direction, nextDistance);
  }

  function syncCameraControls() {
    controls.enabled = !cameraLocked && !isPaused && cameraMode === 'orbit' &&
      !pinchState && drawingPointerId === null && erasePointerId === null;
  }

  function clearCameraInertia() {
    // OrbitControls keeps damping deltas even when disabled. Flush them without
    // moving the saved view, so locking and unlocking never cause a camera jump.
    const position = camera.position.clone();
    const rotation = camera.quaternion.clone();
    const target = controls.target.clone();
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damping;
    camera.position.copy(position);
    camera.quaternion.copy(rotation);
    controls.target.copy(target);
  }

  function setCameraLocked(locked) {
    cameraLocked = Boolean(locked);
    cameraTransition = null;
    pinchState = null;
    clearCameraInertia();
    syncCameraControls();
    if (CAMERA_LOCK) {
      CAMERA_LOCK.setAttribute('aria-pressed', String(cameraLocked));
      CAMERA_LOCK.setAttribute('aria-label', cameraLocked ? 'Unlock camera' : 'Lock camera');
      CAMERA_LOCK.title = cameraLocked ? '解锁视角' : '锁定视角';
    }
  }

  function setDrawTool(tool) {
    cancelDrawing();
    erasePointerId = null;
    drawTool = tool === 'erase' ? 'erase' : 'draw';
    CANVAS.classList.toggle('is-erasing', drawTool === 'erase');
    TOOL_BUTTONS.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.prototypeTool === drawTool));
    });
    syncCameraControls();
  }

  function eraseLine(point) {
    if (!validDrawPoint(point)) return;
    level.removeLineAtPosition(point.x, point.y);
    invalidateLineRender();
  }

  CANVAS.addEventListener('contextmenu', (event) => event.preventDefault());
  CANVAS.addEventListener('pointerdown', (event) => {
    if (!gameStarted || isPaused || app.isLevelEnded || app.isGameEnded) return;
    if (event.pointerType === 'touch') {
      activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
      if (activeTouchPoints().length >= 2) {
        event.preventDefault();
        cancelDrawing();
        erasePointerId = null;
        beginPinchZoom();
        syncCameraControls();
        CANVAS.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (pinchState || drawingPointerId !== null || erasePointerId !== null) return;
    const point = boardPoint(event);
    if (!validDrawPoint(point)) return;
    if (event.button !== 0 && event.button !== 2) return;
    if (drawTool === 'erase' || event.button === 2 || event.ctrlKey || event.metaKey) {
      erasePointerId = event.pointerId;
      eraseLine(point);
    } else {
      drawingPointerId = event.pointerId;
      drawingLine = new Inkball.Line();
      drawingLine.addPoint(point.x, point.y);
      invalidateLineRender();
    }
    syncCameraControls();
    CANVAS.setPointerCapture(event.pointerId);
  });
  CANVAS.addEventListener('pointermove', (event) => {
    if (isPaused || !gameStarted || app.isLevelEnded || app.isGameEnded) return;
    if (event.pointerType === 'touch' && activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
      if (pinchState) {
        event.preventDefault();
        updatePinchZoom();
        return;
      }
    }
    if (erasePointerId === event.pointerId) {
      eraseLine(boardPoint(event));
      return;
    }
    if (!drawingLine || drawingPointerId !== event.pointerId) return;
    const point = boardPoint(event);
    if (!validDrawPoint(point)) return;
    const previous = drawingLine.points[drawingLine.points.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 5) {
      drawingLine.addPoint(point.x, point.y);
      invalidateLineRender();
    }
  });
  function cancelDrawing() {
    drawingPointerId = null;
    drawingLine = null;
    invalidateLineRender();
    syncCameraControls();
  }
  function finishDrawing() {
    if (drawingLine) {
      const line = drawingLine;
      drawingLine = null;
      if (line.points.length >= 2 && !isPaused && gameStarted) {
        level.lines.push(line);
        app.linesDrawn = (app.linesDrawn || 0) + 1;
      }
      invalidateLineRender();
    }
    drawingPointerId = null;
    syncCameraControls();
  }
  function finishPointer(event) {
    if (event.pointerType === 'touch') {
      activePointers.delete(event.pointerId);
      if (activeTouchPoints().length < 2) {
        pinchState = null;
      } else {
        beginPinchZoom();
      }
    }
    if (erasePointerId === event.pointerId) erasePointerId = null;
    if (drawingPointerId === event.pointerId) {
      if (event.type === 'pointercancel' || event.type === 'lostpointercapture') cancelDrawing();
      else finishDrawing();
    }
    syncCameraControls();
  }
  CANVAS.addEventListener('pointerup', finishPointer);
  CANVAS.addEventListener('pointercancel', finishPointer);
  CANVAS.addEventListener('lostpointercapture', finishPointer);

  async function reset(showBriefing = true, options = {}) {
    if (startPending) return;
    startPending = true;
    const wasPaused = isPaused;
    isPaused = true;
    try {
      if (!showBriefing) await InkballOfficialRun.start(boot);
      else if (gameStarted && !resultShown) await InkballOfficialRun.abandon(boot);
      retiringBalls.splice(0).forEach(row => boardGroup.remove(row.mesh));
      animateNewBalls = false;
      ballMeshes.forEach((mesh) => boardGroup.remove(mesh));
      ballMeshes.clear();
      clearObject(lineGroup);
      drawingLine = null;
      drawingPointerId = null;
      erasePointerId = null;
      activePointers.clear();
      pinchState = null;
      invalidateLineRender();
      renderedQueueSignature = null;
      resultShown = false;
      pendingResult = null;
      completionFailed = false;
      RESULT?.querySelector('[data-prototype-save-error]')?.setAttribute('hidden', '');
      RESULT?.querySelector('[data-result-save-retry]')?.setAttribute('hidden', '');
      isPaused = false;
      if (RESULT) RESULT.hidden = true;
      app.isLevelEnded = false;
      app.isGameEnded = false;
      app.score = 0;
      app.correctCaptures = 0;
      app.wrongCaptures = 0;
      app.linesDrawn = 0;
      level = new Inkball.Level(app, levelConfig, boot.layout);
      gameStarted = !showBriefing;
      if (gameStarted) previewLoop.setActive(true);
      syncAmbientBlockField();
      playStartedAt = gameStarted ? Date.now() : 0;
      ROOT.classList.toggle('is-running', gameStarted);
      if (BRIEFING) BRIEFING.hidden = false;
      cameraMode = 'orbit';
      syncCameraControls();
      if (!cameraLocked) setCameraPose(gameStarted ? 'play' : 'preview', Boolean(options.animateCamera && gameStarted));
      lastTime = performance.now();
      syncPauseUi();
    } catch (error) {
      isPaused = wasPaused;
      await InkballUI.alert(Inkball.t('game.startFailed', { message: error.message }));
    } finally {
      startPending = false;
    }
  }

  function startGame() {
    if (gameStarted) return;
    directPlayMode = !boot.community || Boolean(boot.communityRun);
    return reset(false, { animateCamera: true });
  }

  function syncPauseUi() {
    const ended = app.isLevelEnded || app.isGameEnded || resultShown;
    const canPause = gameStarted && !ended;
    if (PAUSE_OPEN) PAUSE_OPEN.hidden = !canPause;
    if (TOOLS) TOOLS.hidden = !canPause;
    if (CAMERA_LOCK) CAMERA_LOCK.hidden = !canPause;
    if (!PAUSE_OVERLAY) return;
    const visible = canPause && isPaused;
    PAUSE_OVERLAY.hidden = !visible;
    if (visible && !PAUSE_OVERLAY.open) {
      if (window.InkballUI && typeof window.InkballUI.present === 'function') {
        window.InkballUI.present(PAUSE_OVERLAY);
      } else {
        PAUSE_OVERLAY.showModal();
      }
      PAUSE_RESUME?.focus();
    } else if (!visible && PAUSE_OVERLAY.open) {
      PAUSE_OVERLAY.close();
    }
  }

  function pauseGame() {
    if (!gameStarted || app.isLevelEnded || app.isGameEnded) return;
    isPaused = true;
    cancelDrawing();
    erasePointerId = null;
    activePointers.clear();
    pinchState = null;
    syncCameraControls();
    syncPauseUi();
  }

  function resumeGame() {
    if (!gameStarted || app.isLevelEnded || app.isGameEnded) return;
    isPaused = false;
    syncCameraControls();
    lastTime = performance.now();
    syncPauseUi();
  }

  function resize() {
    const rect = ROOT.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }

  function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, Inkball.MAX_DT);
    lastTime = now;
    if (gameStarted && !isPaused) level.update(dt);
    syncBrickVisuals();
    syncMechanismVisuals();
    syncBalls();
    rebuildLines();
    updateAmbientBlockField(ambientBlockField, now * 0.001);
    const firstBall = level.ballsInGame[0];
    cellMorph.tick(now);
    updateBallMorph(now);
    const previewIsTransitioning = updatePreviewMorph(now);
    const cameraIsTransitioning = !cameraLocked && !previewIsTransitioning && updateCameraTransition(now);
    if (!cameraLocked && !cameraIsTransitioning && gameStarted && !isPaused && cameraMode === 'follow' && firstBall) {
      const target = new THREE.Vector3(
        worldXFromPixel(firstBall.x + firstBall.size / 2), 0.25,
        worldZFromPixel(firstBall.y + firstBall.size / 2)
      );
      camera.position.lerp(target.clone().add(new THREE.Vector3(-4.2, 5.8, 6.8)), 0.04);
      controls.target.lerp(target, 0.06);
    }
    if (!cameraLocked && !previewIsTransitioning) controls.update();
    renderer.render(scene, camera);
    if (!readyPosted) {
      readyPosted = true;
      ROOT.dataset.rendererStage = 'ready';
      window.parent?.postMessage({
        type: 'inkball:3d-ready', session: window.INKBALL_3D_SESSION,
        map: boot.map,
        difficulty: boot.difficulty,
        request: readyRequest,
      }, '*');
    }
    renderDashboard();
    if (app.isLevelEnded) {
      isPaused = false;
      syncPauseUi();
      if (directPlayMode) finishAttempt();
      else showResult();
    }
  }

  const previewLoop = createPreviewLoop(animate, window.InkballFrameClock.create(window));
  // The native host reads state through this adapter; rendering stays reference-identical.
  window.Inkball3D = {
    get app() { return app; }, get level() { return level; },
    get selection() { return { map: boot.map, difficulty: boot.difficulty }; },
    get started() { return gameStarted; }, get paused() { return isPaused; },
    get cameraLocked() { return cameraLocked; }, get drawTool() { return drawTool; },
    get camera() { return camera; }, get controls() { return controls; },
    get renderer() { return renderer; }, get scene() { return scene; },
    pause: pauseGame, resume: resumeGame, restart: () => reset(false),
    renderFrame: () => animate(performance.now()),
    texturesLoaded: () => [gridTexture, ballMatcap, metalNormal, metalRoughness, metalnessMap,
      plasterDiffuse, plasterNormal, plasterRoughness, plasterAO,
      holeMetalColor, holeMetalNormal, holeMetalRoughness, holeMetalMetalness,
      holePlateColor, holePlateNormal, holePlateRoughness, holePlateMetalness]
      .every(texture => texture.image && texture.image.width > 0),
    setTool: setDrawTool, setCameraLocked,
  };
  window.addEventListener('pagehide', () => {
    previewLoop.setActive(false);
    controls.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }, { once: true });
  window.addEventListener('resize', resize);
  document.querySelectorAll('[data-camera-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      cameraMode = button.dataset.cameraMode || 'orbit';
      syncCameraControls();
    });
  });
  document.querySelector('[data-reset-demo]')?.addEventListener('click', reset);
  document.querySelector('[data-prototype-start]')?.addEventListener('click', startGame);
  document.querySelector('[data-result-restart]')?.addEventListener('click', () => reset(false));
  document.querySelector('[data-result-close]')?.addEventListener('click', () => { if (RESULT) RESULT.hidden = true; });
  document.querySelector('[data-result-save-retry]')?.addEventListener('click', () => {
    resultShown = false;
    completionFailed = false;
    if (RESULT) RESULT.hidden = true;
    finishAttempt();
  });
  TOOL_BUTTONS.forEach(button => button.addEventListener('click', () => setDrawTool(button.dataset.prototypeTool)));
  CAMERA_LOCK?.addEventListener('click', () => setCameraLocked(!cameraLocked));
  if (PAUSE_HOME) {
    PAUSE_HOME.href = boot.home_url || '/';
    PAUSE_HOME.addEventListener('click', async event => {
      event.preventDefault();
      if (!await exitRun()) return;
      // Navigate the containing difficulty page, not its 3D preview iframe.
      // Its scene manager preserves native fullscreen when a fullscreen host exists.
      const host = window;
      if (host.InkballScene) host.InkballScene.navigate(PAUSE_HOME.href);
      else host.location.assign(PAUSE_HOME.href);
    });
  }
  PAUSE_OPEN?.addEventListener('click', pauseGame);
  PAUSE_RESTART?.addEventListener('click', () => reset(false));
  PAUSE_RESUME?.addEventListener('click', resumeGame);
  PAUSE_OVERLAY?.addEventListener('cancel', (event) => {
    event.preventDefault();
    resumeGame();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    if (!gameStarted || app.isLevelEnded || app.isGameEnded) return;
    event.preventDefault();
    if (isPaused) resumeGame();
    else pauseGame();
  });
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    if (event.data?.type === 'inkball:3d-preview-active') {
      if (backgroundMode && !gameStarted && event.data.map === boot.map) {
        if (!event.data.active) morphPreview({ mode: '2d', duration: 0 });
        previewLoop.setActive(event.data.active);
      }
      return;
    }
    if (event.data?.type === 'inkball:3d-preview-update') { updatePreview(event.data); return; }
    if (event.data?.type === 'inkball:3d-preview-morph') { morphPreview(event.data); return; }
    if (!event.data || event.data.type !== 'inkball:start-embedded-3d') return;
    if (event.data.map && event.data.map !== boot.map) return;
    if (event.data.difficulty && event.data.difficulty !== boot.difficulty) return;
    if (event.data.communityRun) boot.communityRun = String(event.data.communityRun);
    if (event.data.resultUrl) boot.result_url = String(event.data.resultUrl);
    directPlayMode = !boot.community || Boolean(boot.communityRun);
    previewMorph = null; previewDepth = 1;
    boardGroup.scale.y = 1;
    camera.clearViewOffset();
    cellMorph.finish();
    ROOT.classList.add('is-play-mode', 'is-embedded-play-mode', 'is-running');
    ROOT.classList.remove('is-background-mode');
    syncAmbientBlockField();
    reset(false, { animateCamera: true });
  });

  resize();
  loadBriefing();
  if (autoStartMode && !backgroundMode) await reset(false);
  syncAmbientBlockField();
  renderDashboard();
  syncPauseUi();
  syncBalls();
  // Warm all scene and drawing resources while the 2D board remains visible.
  ROOT.dataset.rendererStage = 'compiling';
  await warmDrawingResources();
  ROOT.dataset.rendererStage = 'compiled';
  lastTime = performance.now();
  // WKWebView can suspend rAF in an opacity-zero preview. Render one warm frame
  // synchronously so the host can reveal it, then use the reference frame loop.
  animate(performance.now());
  previewLoop.start();
}

main().catch(error => {
  const map = BOOT_NODE && JSON.parse(BOOT_NODE.textContent).selected.map;
  window.parent?.postMessage({ type: 'inkball:3d-preview-error', session: window.INKBALL_3D_SESSION, message: error.message, map }, '*');
  ROOT.dataset.renderError = error.message || String(error);
  console.error(error);
});
