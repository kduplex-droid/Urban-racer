import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

// ------------------------------------------------------------
// DOM
// ------------------------------------------------------------
const app = document.getElementById('app');
const canvas = document.getElementById('gameCanvas');
const playButton = document.getElementById('playButton');
const menu = document.getElementById('menu');
const hud = document.getElementById('hud');
const loading = document.getElementById('loading');
const speedValue = document.getElementById('speedValue');
const gearValue = document.getElementById('gearValue');
const modeValue = document.getElementById('modeValue');
const cameraValue = document.getElementById('cameraValue');
const interactionHint = document.getElementById('interactionHint');
const missionTitle = document.getElementById('missionTitle');
const missionText = document.getElementById('missionText');
const missionMeta = document.getElementById('missionMeta');
const minimapPanel = document.getElementById('minimapPanel');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapToggle = document.getElementById('minimapToggle');
const minimapCtx = minimapCanvas.getContext('2d');
const mobileControls = document.getElementById('mobileControls');
const touchButtons = [...document.querySelectorAll('.touch-btn')];

// ------------------------------------------------------------
// Core Three.js setup
// ------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaec9e8);
scene.fog = new THREE.Fog(0xaec9e8, 180, 520);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1400);
camera.position.set(0, 6, 12);

const clock = new THREE.Clock();

// ------------------------------------------------------------
// Global data
// ------------------------------------------------------------
const obstacles = [];
const trafficCars = [];
const pedestrians = [];
const trafficLightVisuals = [];
const trafficSignalState = {
  elapsed: 0,
  totalCycle: 19.4,
  zGreenDuration: 7.8,
  amberDuration: 1.5,
  allRedDuration: 0.9,
  xGreenDuration: 7.8
};
const roadSurfaceY = 0.03;
const worldHalf = 340;
const roadWidth = 24;
const roadHalf = roadWidth * 0.5;
const roadCenters = [-240, -120, 0, 120, 240];
const boundaryPadding = 8;
const laneOffsets = [-7.5, -2.5, 2.5, 7.5];
const minimapRange = 92;

const materials = {
  asphalt: new THREE.MeshStandardMaterial({ color: 0x2f3135, roughness: 0.92, metalness: 0.02 }),
  asphaltEdge: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.95 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xc7c7c3, roughness: 0.95 }),
  curb: new THREE.MeshStandardMaterial({ color: 0xa4a39d, roughness: 0.92 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x6b8fb4, roughness: 0.08, metalness: 0.15, transmission: 0.08, transparent: true, opacity: 0.78 }),
  buildingA: new THREE.MeshStandardMaterial({ color: 0x8c9197, roughness: 0.88, metalness: 0.08 }),
  buildingB: new THREE.MeshStandardMaterial({ color: 0x5f6874, roughness: 0.86, metalness: 0.12 }),
  buildingC: new THREE.MeshStandardMaterial({ color: 0x9a8777, roughness: 0.9, metalness: 0.05 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x718a58, roughness: 1.0, metalness: 0.0 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x1a1e25, roughness: 0.55, metalness: 0.7 }),
  metalLight: new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.4, metalness: 0.85 }),
  carPaint: new THREE.MeshStandardMaterial({ color: 0xcf2f2a, roughness: 0.25, metalness: 0.65 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x131313, roughness: 1.0, metalness: 0.02 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x6d747d, roughness: 0.32, metalness: 0.95 }),
  lightOn: new THREE.MeshStandardMaterial({ color: 0xfff3d4, emissive: 0xffd98a, emissiveIntensity: 1.15, roughness: 0.4 }),
  lightRed: new THREE.MeshStandardMaterial({ color: 0xb22a22, emissive: 0xff3c28, emissiveIntensity: 0.4 }),
  lineWhite: new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.8 }),
  lineYellow: new THREE.MeshStandardMaterial({ color: 0xe7c54a, roughness: 0.8 }),
  foliage: new THREE.MeshStandardMaterial({ color: 0x5a7a4a, roughness: 1.0 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x64452d, roughness: 1.0 }),
  barrier: new THREE.MeshStandardMaterial({ color: 0x90969f, roughness: 0.72, metalness: 0.45 }),
  missionRing: new THREE.MeshStandardMaterial({ color: 0x5fd0ff, emissive: 0x58c6ff, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.35 }),
  missionBeam: new THREE.MeshStandardMaterial({ color: 0x74d8ff, emissive: 0x74d8ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.22, depthWrite: false })
};

const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const pointerNdc = new THREE.Vector2();

// ------------------------------------------------------------
// Input state
// ------------------------------------------------------------
const input = {
  accelerate: false,
  brake: false,
  left: false,
  right: false,
  handbrake: false,
  sprint: false,
  horn: false
};

const uiState = {
  minimapCollapsed: false,
  mobileControlsVisible: false
};

window.addEventListener('keydown', (event) => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyM', 'KeyR', 'KeyE', 'KeyC', 'KeyH', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
    event.preventDefault();
  }

  switch (event.code) {
    case 'KeyW':
      input.accelerate = true;
      break;
    case 'KeyS':
      input.brake = true;
      break;
    case 'KeyA':
      input.left = true;
      break;
    case 'KeyD':
      input.right = true;
      break;
    case 'Space':
      input.handbrake = true;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      input.sprint = true;
      break;
    case 'KeyH':
      input.horn = true;
      break;
    case 'KeyM':
      if (!event.repeat) toggleMinimap();
      break;
    case 'KeyR':
      if (!event.repeat) {
        if (playerState?.inVehicle) resetVehicle();
        else resetOnFootNearCar();
      }
      break;
    case 'KeyE':
      if (!event.repeat) handleInteract();
      break;
    case 'KeyC':
      if (!event.repeat) toggleCameraMode();
      break;
  }
});

window.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'KeyW':
      input.accelerate = false;
      break;
    case 'KeyS':
      input.brake = false;
      break;
    case 'KeyA':
      input.left = false;
      break;
    case 'KeyD':
      input.right = false;
      break;
    case 'Space':
      input.handbrake = false;
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      input.sprint = false;
      break;
    case 'KeyH':
      input.horn = false;
      break;
  }
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (setMoveTargetFromScreen(event.clientX, event.clientY)) {
    event.preventDefault();
  }
}, { passive: false });


minimapToggle.addEventListener('click', toggleMinimap);

function updateMobileUi() {
  const wantsTouchUi = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 900;
  uiState.mobileControlsVisible = wantsTouchUi;
  document.body.classList.toggle('mobile-ui', wantsTouchUi);
  mobileControls.classList.toggle('hidden', !wantsTouchUi);
}

function runTouchAction(action) {
  if (!gameStarted) return;
  if (action === 'interact') handleInteract();
  else if (action === 'camera') toggleCameraMode();
  else if (action === 'minimap') toggleMinimap();
}

function setHeldInput(name, active, button) {
  if (!(name in input)) return;
  input[name] = active;
  if (button) button.classList.toggle('active', active);
}

for (const button of touchButtons) {
  const hold = button.dataset.hold;
  const tap = button.dataset.tap;

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.setPointerCapture) {
      try { button.setPointerCapture(event.pointerId); } catch (error) {}
    }
    if (hold) setHeldInput(hold, true, button);
  }, { passive: false });

  const release = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (hold) setHeldInput(hold, false, button);
  };

  button.addEventListener('pointerup', release, { passive: false });
  button.addEventListener('pointercancel', release, { passive: false });
  button.addEventListener('lostpointercapture', release, { passive: false });
  button.addEventListener('pointerleave', (event) => {
    if (hold && event.buttons === 0) release(event);
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (tap) runTouchAction(tap);
  });
}

// ------------------------------------------------------------
// Utility helpers
// ------------------------------------------------------------
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function damp(current, target, smoothing, dt) {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

function hash2(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function isNearRoadCenter(value, padding = 0) {
  return roadCenters.some((center) => Math.abs(value - center) <= roadHalf + padding);
}

function makeBox(width, height, depth, material) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
}

function makeCylinder(radiusTop, radiusBottom, height, radialSegments, material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material);
}

function addObstacle(x, z, width, depth) {
  obstacles.push({ x, z, halfW: width * 0.5, halfD: depth * 0.5 });
}

function addParkedCarObstacle(x, z, rotationY, scale = 1) {
  const width = 1.9 * scale;
  const depth = 4.15 * scale;
  const isSideways = Math.abs(Math.sin(rotationY)) > 0.7;
  addObstacle(x, z, isSideways ? depth : width, isSideways ? width : depth);
}

function getRoadIntervals() {
  const edges = [-worldHalf];
  for (const center of roadCenters) {
    edges.push(center - roadHalf, center + roadHalf);
  }
  edges.push(worldHalf);

  const intervals = [];
  for (let i = 0; i < edges.length - 1; i += 2) {
    intervals.push([edges[i], edges[i + 1]]);
  }
  return intervals;
}

function toggleMinimap() {
  uiState.minimapCollapsed = !uiState.minimapCollapsed;
  minimapPanel.classList.toggle('collapsed', uiState.minimapCollapsed);
  minimapToggle.textContent = uiState.minimapCollapsed ? 'Show' : 'Hide';
}

function resizeMinimapCanvas() {
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = minimapCanvas.clientWidth || 240;
  const cssHeight = minimapCanvas.clientHeight || cssWidth;
  minimapCanvas.width = Math.round(cssWidth * scale);
  minimapCanvas.height = Math.round(cssHeight * scale);
}

function clearMoveTarget() {
  playerState.moveTargetActive = false;
  playerState.moveTargetRun = false;
  moveCursorMarker.visible = false;
}

function setMoveTarget(point, shouldRun = false) {
  playerState.moveTarget.copy(point);
  playerState.moveTarget.y = 0;
  playerState.moveTargetActive = true;
  playerState.moveTargetRun = shouldRun || playerState.position.distanceTo(point) > 14;
  moveCursorMarker.position.set(point.x, 0.12, point.z);
  moveCursorMarker.visible = true;
}

function setMoveTargetFromScreen(clientX, clientY) {
  if (!gameStarted || playerState.inVehicle) return false;
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(groundPlane, hit)) return false;
  hit.x = clamp(hit.x, -worldHalf + 4, worldHalf - 4);
  hit.z = clamp(hit.z, -worldHalf + 4, worldHalf - 4);
  setMoveTarget(hit, input.sprint);
  return true;
}

function vehicleForward() {
  return new THREE.Vector3(Math.sin(vehicle.heading), 0, Math.cos(vehicle.heading));
}

function vehicleRight() {
  return new THREE.Vector3(Math.cos(vehicle.heading), 0, -Math.sin(vehicle.heading));
}

function getActiveFocusPosition() {
  return playerState?.inVehicle ? vehicle.position : playerState.position;
}

function getActiveHeading() {
  return playerState?.inVehicle ? vehicle.heading : playerState.heading;
}

function pointInsideAABB(x, z, box, radius = 0) {
  return Math.abs(x - box.x) <= box.halfW + radius && Math.abs(z - box.z) <= box.halfD + radius;
}

function resolveCircleAgainstAABB(position, radius, box) {
  const dx = position.x - box.x;
  const dz = position.z - box.z;
  const clampedX = clamp(dx, -box.halfW, box.halfW);
  const clampedZ = clamp(dz, -box.halfD, box.halfD);
  const nearestX = box.x + clampedX;
  const nearestZ = box.z + clampedZ;
  let pushX = position.x - nearestX;
  let pushZ = position.z - nearestZ;
  let distSq = pushX * pushX + pushZ * pushZ;

  if (distSq >= radius * radius) return false;

  if (distSq < 1e-8) {
    const overlapX = box.halfW + radius - Math.abs(dx);
    const overlapZ = box.halfD + radius - Math.abs(dz);
    if (overlapX < overlapZ) {
      pushX = dx >= 0 ? overlapX : -overlapX;
      pushZ = 0;
    } else {
      pushX = 0;
      pushZ = dz >= 0 ? overlapZ : -overlapZ;
    }
  } else {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;
    pushX = (pushX / dist) * overlap;
    pushZ = (pushZ / dist) * overlap;
  }

  position.x += pushX;
  position.z += pushZ;
  return true;
}

function resolveCircleCollisions(position, radius, includeTraffic = true) {
  let hit = false;
  for (const obstacle of obstacles) {
    hit = resolveCircleAgainstAABB(position, radius, obstacle) || hit;
  }
  if (includeTraffic) {
    for (const car of trafficCars) {
      hit = resolveCircleAgainstAABB(position, radius, getTrafficAABB(car)) || hit;
    }
  }
  if (typeof playerState !== 'undefined' && !playerState.inVehicle) {
    hit = resolveCircleAgainstAABB(position, radius, getPlayerCarAABB()) || hit;
  }
  return hit;
}

// ------------------------------------------------------------
// World builders
// ------------------------------------------------------------
function createWindowStrips(mesh, width, height, depth, levels) {
  const windowGroup = new THREE.Group();
  const inset = 0.06;
  const faceZ = depth * 0.5 + inset;
  const sideX = width * 0.5 + inset;

  const frontWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.78, height * 0.74),
    new THREE.MeshStandardMaterial({ color: 0x7596b8, emissive: 0xa3b8ff, emissiveIntensity: 0.08, roughness: 0.2, metalness: 0.55 })
  );
  frontWindow.position.set(0, 0.1, faceZ);
  windowGroup.add(frontWindow);

  const backWindow = frontWindow.clone();
  backWindow.rotation.y = Math.PI;
  backWindow.position.z = -faceZ;
  windowGroup.add(backWindow);

  const sideWindowGeometry = new THREE.PlaneGeometry(depth * 0.72, height * 0.74);
  const sideWindowMaterial = frontWindow.material.clone();
  const leftWindow = new THREE.Mesh(sideWindowGeometry, sideWindowMaterial);
  leftWindow.rotation.y = Math.PI * 0.5;
  leftWindow.position.set(sideX, 0.1, 0);
  windowGroup.add(leftWindow);

  const rightWindow = leftWindow.clone();
  rightWindow.rotation.y = -Math.PI * 0.5;
  rightWindow.position.x = -sideX;
  windowGroup.add(rightWindow);

  if (levels > 8) {
    const stripMaterial = new THREE.MeshStandardMaterial({ color: 0xddd4b8, emissive: 0xffc873, emissiveIntensity: 0.18, roughness: 0.4 });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.4, 0.38), stripMaterial);
    strip.position.set(0, height * 0.28, faceZ + 0.01);
    windowGroup.add(strip);
  }

  mesh.add(windowGroup);
}

function createSkySun() {
  const hemi = new THREE.HemisphereLight(0xc5dcff, 0x44513a, 1.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff2d2, 2.2);
  sun.position.set(-120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -210;
  sun.shadow.camera.right = 210;
  sun.shadow.camera.top = 210;
  sun.shadow.camera.bottom = -210;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
}

function createGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), materials.grass);
  ground.rotation.x = -Math.PI * 0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const cityBase = new THREE.Mesh(
    new THREE.PlaneGeometry(worldHalf * 2 + 80, worldHalf * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x677260, roughness: 1.0 })
  );
  cityBase.rotation.x = -Math.PI * 0.5;
  cityBase.position.y = 0.005;
  cityBase.receiveShadow = true;
  scene.add(cityBase);
}

function createRoadNetwork() {
  const roadLength = worldHalf * 2;
  const roadShoulder = 2;

  for (const x of roadCenters) {
    const road = makeBox(roadWidth, 0.08, roadLength, materials.asphalt);
    road.position.set(x, roadSurfaceY, 0);
    road.receiveShadow = true;
    scene.add(road);

    const edgeLeft = makeBox(roadShoulder, 0.14, roadLength, materials.asphaltEdge);
    edgeLeft.position.set(x - roadHalf + roadShoulder * 0.5, roadSurfaceY + 0.03, 0);
    edgeLeft.receiveShadow = true;
    scene.add(edgeLeft);

    const edgeRight = edgeLeft.clone();
    edgeRight.position.x = x + roadHalf - roadShoulder * 0.5;
    scene.add(edgeRight);

    for (let z = -worldHalf + 10; z < worldHalf - 10; z += 14) {
      const dash = makeBox(0.33, 0.02, 7.2, materials.lineYellow);
      dash.position.set(x, roadSurfaceY + 0.06, z);
      dash.receiveShadow = true;
      scene.add(dash);
    }

    for (const laneOffset of [-5, 5]) {
      const laneLine = makeBox(0.14, 0.02, roadLength, materials.lineWhite);
      laneLine.position.set(x + laneOffset, roadSurfaceY + 0.05, 0);
      laneLine.receiveShadow = true;
      scene.add(laneLine);
    }
  }

  for (const z of roadCenters) {
    const road = makeBox(roadLength, 0.08, roadWidth, materials.asphalt);
    road.position.set(0, roadSurfaceY + 0.01, z);
    road.receiveShadow = true;
    scene.add(road);

    const edgeFront = makeBox(roadLength, 0.14, roadShoulder, materials.asphaltEdge);
    edgeFront.position.set(0, roadSurfaceY + 0.03, z - roadHalf + roadShoulder * 0.5);
    edgeFront.receiveShadow = true;
    scene.add(edgeFront);

    const edgeBack = edgeFront.clone();
    edgeBack.position.z = z + roadHalf - roadShoulder * 0.5;
    scene.add(edgeBack);

    for (let x = -worldHalf + 10; x < worldHalf - 10; x += 14) {
      const dash = makeBox(7.2, 0.02, 0.33, materials.lineWhite);
      dash.position.set(x, roadSurfaceY + 0.07, z);
      dash.receiveShadow = true;
      scene.add(dash);
    }

    for (const laneOffset of [-5, 5]) {
      const laneLine = makeBox(roadLength, 0.02, 0.14, materials.lineWhite);
      laneLine.position.set(0, roadSurfaceY + 0.05, z + laneOffset);
      laneLine.receiveShadow = true;
      scene.add(laneLine);
    }
  }
}

function createSidewalkBlock(xMin, xMax, zMin, zMax) {
  const width = xMax - xMin;
  const depth = zMax - zMin;
  const centerX = (xMin + xMax) * 0.5;
  const centerZ = (zMin + zMax) * 0.5;

  const sidewalk = makeBox(width, 0.36, depth, materials.sidewalk);
  sidewalk.position.set(centerX, 0.18, centerZ);
  sidewalk.receiveShadow = true;
  scene.add(sidewalk);

  const plaza = makeBox(Math.max(width - 10, 4), 0.04, Math.max(depth - 10, 4), new THREE.MeshStandardMaterial({ color: 0xb7b3ab, roughness: 0.95 }));
  plaza.position.set(centerX, 0.38, centerZ);
  plaza.receiveShadow = true;
  scene.add(plaza);
}

function createBuildingLot(x, z, width, depth, height, material, castShadow = true) {
  const building = makeBox(width, height, depth, material);
  building.position.set(x, height * 0.5 + 0.36, z);
  building.castShadow = castShadow;
  building.receiveShadow = true;
  scene.add(building);
  createWindowStrips(building, width, height, depth, Math.round(height / 4));
  addObstacle(x, z, width, depth);

  const roofCap = makeBox(width * 0.95, 0.4, depth * 0.95, materials.metalDark);
  roofCap.position.set(x, height + 0.58, z);
  roofCap.castShadow = castShadow;
  roofCap.receiveShadow = true;
  scene.add(roofCap);
}

function createTreesAlongBlock(xMin, xMax, zMin, zMax) {
  const treeGeometryTop = new THREE.SphereGeometry(2.8, 10, 10);
  const treeGeometryTrunk = new THREE.CylinderGeometry(0.42, 0.52, 3.6, 8);

  const perimeter = [];
  const spacingX = 18;
  const spacingZ = 18;
  for (let x = xMin + 9; x <= xMax - 9; x += spacingX) {
    perimeter.push([x, zMin + 5], [x, zMax - 5]);
  }
  for (let z = zMin + 9; z <= zMax - 9; z += spacingZ) {
    perimeter.push([xMin + 5, z], [xMax - 5, z]);
  }

  for (const [x, z] of perimeter) {
    if (hash2(x, z) < 0.32) continue;
    const trunk = new THREE.Mesh(treeGeometryTrunk, materials.trunk);
    trunk.position.set(x, 2.1, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    scene.add(trunk);

    const top = new THREE.Mesh(treeGeometryTop, materials.foliage);
    top.position.set(x, 5.25 + hash2(x + 1.2, z - 2.1) * 1.2, z);
    top.scale.setScalar(0.85 + hash2(x - 1.4, z + 1.7) * 0.42);
    top.castShadow = true;
    top.receiveShadow = true;
    scene.add(top);

    addObstacle(x, z, 2.8, 2.8);
  }
}

function createStreetlights() {
  const lampPoleGeometry = new THREE.CylinderGeometry(0.14, 0.18, 8.2, 10);
  const armGeometry = new THREE.BoxGeometry(2.6, 0.14, 0.16);
  const lampGeometry = new THREE.BoxGeometry(0.74, 0.28, 0.48);
  const bulbGeometry = new THREE.SphereGeometry(0.16, 8, 8);

  const positions = [];
  for (const x of roadCenters) {
    for (let z = -worldHalf + 24; z <= worldHalf - 24; z += 48) {
      if (isNearRoadCenter(z, 8)) continue;
      positions.push([x - roadHalf - 3.5, z, 1]);
      positions.push([x + roadHalf + 3.5, z, -1]);
    }
  }
  for (const z of roadCenters) {
    for (let x = -worldHalf + 24; x <= worldHalf - 24; x += 48) {
      if (isNearRoadCenter(x, 8)) continue;
      positions.push([x, z - roadHalf - 3.5, 0]);
      positions.push([x, z + roadHalf + 3.5, 2]);
    }
  }

  positions.forEach(([x, z, orientation], index) => {
    const group = new THREE.Group();

    const pole = new THREE.Mesh(lampPoleGeometry, materials.metalDark);
    pole.position.y = 4.1;
    pole.castShadow = index % 6 === 0;
    pole.receiveShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(armGeometry, materials.metalLight);
    arm.position.set(0.95, 8.0, 0);
    group.add(arm);

    const lamp = new THREE.Mesh(lampGeometry, materials.metalDark);
    lamp.position.set(2.08, 7.87, 0);
    group.add(lamp);

    const bulb = new THREE.Mesh(bulbGeometry, materials.lightOn);
    bulb.position.set(2.28, 7.66, 0);
    group.add(bulb);

    group.position.set(x, 0, z);
    if (orientation === 1) group.rotation.y = Math.PI;
    if (orientation === 2) group.rotation.y = -Math.PI * 0.5;
    if (orientation === 0) group.rotation.y = Math.PI * 0.5;
    scene.add(group);

    addObstacle(x, z, 0.8, 0.8);
  });
}

function createTrafficLights() {
  const lightBoxMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.55, metalness: 0.4 });
  const poleMaterial = materials.metalLight;

  for (const x of roadCenters) {
    for (const z of roadCenters) {
      const corners = [
        [x - roadHalf - 2.4, z - roadHalf - 2.4, 0],
        [x + roadHalf + 2.4, z - roadHalf - 2.4, Math.PI * 0.5],
        [x + roadHalf + 2.4, z + roadHalf + 2.4, Math.PI],
        [x - roadHalf - 2.4, z + roadHalf + 2.4, -Math.PI * 0.5]
      ];

      corners.forEach(([cx, cz, rot], index) => {
        const group = new THREE.Group();

        const pole = makeCylinder(0.11, 0.12, 5.8, 8, poleMaterial);
        pole.position.y = 2.9;
        group.add(pole);

        const arm = makeBox(1.7, 0.1, 0.1, poleMaterial);
        arm.position.set(0.8, 5.4, 0);
        group.add(arm);

        const housing = makeBox(0.35, 0.96, 0.34, lightBoxMaterial);
        housing.position.set(1.55, 5.05, 0);
        group.add(housing);

        const red = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), materials.lightRed);
        red.position.set(1.74, 5.32, 0.12);
        group.add(red);

        const amber = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe3a93e, emissive: 0xffb21d, emissiveIntensity: index % 7 === 0 ? 0.3 : 0.04 }));
        amber.position.set(1.74, 5.05, 0.12);
        group.add(amber);

        const green = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0x1c9447, emissive: 0x4eff86, emissiveIntensity: index % 7 === 0 ? 0.24 : 0.04 }));
        green.position.set(1.74, 4.78, 0.12);
        group.add(green);

        group.position.set(cx, 0, cz);
        group.rotation.y = rot;
        scene.add(group);

        trafficLightVisuals.push({
          controlledAxis: index % 2 === 0 ? 'z' : 'x',
          red,
          amber,
          green
        });

        addObstacle(cx, cz, 0.9, 0.9);
      });
    }
  }
}

function createBoundaryBarriers() {
  const wallThickness = 2.2;
  const wallHeight = 2.8;

  const north = makeBox(worldHalf * 2, wallHeight, wallThickness, materials.barrier);
  north.position.set(0, wallHeight * 0.5, -worldHalf - boundaryPadding);
  north.castShadow = true;
  north.receiveShadow = true;
  scene.add(north);
  addObstacle(0, -worldHalf - boundaryPadding, worldHalf * 2, wallThickness);

  const south = north.clone();
  south.position.z = worldHalf + boundaryPadding;
  scene.add(south);
  addObstacle(0, worldHalf + boundaryPadding, worldHalf * 2, wallThickness);

  const west = makeBox(wallThickness, wallHeight, worldHalf * 2, materials.barrier);
  west.position.set(-worldHalf - boundaryPadding, wallHeight * 0.5, 0);
  west.castShadow = true;
  west.receiveShadow = true;
  scene.add(west);
  addObstacle(-worldHalf - boundaryPadding, 0, wallThickness, worldHalf * 2);

  const east = west.clone();
  east.position.x = worldHalf + boundaryPadding;
  scene.add(east);
  addObstacle(worldHalf + boundaryPadding, 0, wallThickness, worldHalf * 2);
}

function createDecorProps() {
  const hillMaterial = new THREE.MeshStandardMaterial({ color: 0x728468, roughness: 1.0 });
  const hillGeometry = new THREE.SphereGeometry(1, 16, 16);

  const hills = [
    [-420, 28, -260, 160],
    [430, 22, -60, 150],
    [-390, 35, 210, 180],
    [340, 24, 280, 120]
  ];

  hills.forEach(([x, height, z, radius]) => {
    const hill = new THREE.Mesh(hillGeometry, hillMaterial);
    hill.scale.set(radius, height, radius * 0.85);
    hill.position.set(x, height - 2, z);
    hill.receiveShadow = true;
    scene.add(hill);
  });
}

function createParkedCar(color, scale = 1) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.58 });

  const base = makeBox(1.9 * scale, 0.55 * scale, 4.15 * scale, paint);
  base.position.y = 0.88 * scale;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cabin = makeBox(1.58 * scale, 0.56 * scale, 1.9 * scale, materials.glass);
  cabin.position.set(0, 1.32 * scale, -0.12 * scale);
  cabin.castShadow = true;
  group.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(0.38 * scale, 0.38 * scale, 0.3 * scale, 16);
  const wheelPositions = [
    [-0.96, 0.4, 1.25],
    [0.96, 0.4, 1.25],
    [-0.96, 0.4, -1.25],
    [0.96, 0.4, -1.25]
  ];

  for (const [x, y, z] of wheelPositions) {
    const tire = new THREE.Mesh(wheelGeometry, materials.tire);
    tire.rotation.z = Math.PI * 0.5;
    tire.position.set(x * scale, y * scale, z * scale);
    tire.castShadow = true;
    group.add(tire);
  }

  return group;
}

function populateBlocks() {
  const intervals = getRoadIntervals();
  const blockMargin = 6;

  for (const [xMin, xMax] of intervals) {
    for (const [zMin, zMax] of intervals) {
      createSidewalkBlock(xMin, xMax, zMin, zMax);
      createTreesAlongBlock(xMin, xMax, zMin, zMax);

      const innerMinX = xMin + blockMargin;
      const innerMaxX = xMax - blockMargin;
      const innerMinZ = zMin + blockMargin;
      const innerMaxZ = zMax - blockMargin;
      const blockWidth = innerMaxX - innerMinX;
      const blockDepth = innerMaxZ - innerMinZ;

      if (blockWidth < 18 || blockDepth < 18) continue;

      const lotCols = blockWidth > 85 ? 2 : 1;
      const lotRows = blockDepth > 85 ? 2 : 1;
      const lotGap = 8;
      const lotWidth = (blockWidth - lotGap * (lotCols - 1)) / lotCols;
      const lotDepth = (blockDepth - lotGap * (lotRows - 1)) / lotRows;

      for (let row = 0; row < lotRows; row++) {
        for (let col = 0; col < lotCols; col++) {
          const lotX = innerMinX + col * (lotWidth + lotGap);
          const lotZ = innerMinZ + row * (lotDepth + lotGap);
          const cx = lotX + lotWidth * 0.5;
          const cz = lotZ + lotDepth * 0.5;
          const towerWidth = lotWidth * (0.55 + hash2(cx * 0.4, cz * 0.3) * 0.28);
          const towerDepth = lotDepth * (0.55 + hash2(cx * 0.2, cz * 0.7) * 0.28);
          const towerHeight = 12 + Math.round(hash2(cx, cz) * 14) * 4;
          const materialRoll = hash2(cx * 2.1, cz * 1.4);
          const material = materialRoll < 0.33
            ? materials.buildingA
            : materialRoll < 0.66
              ? materials.buildingB
              : materials.buildingC;

          createBuildingLot(cx, cz, towerWidth, towerDepth, towerHeight, material, Math.abs(cx) < 170 && Math.abs(cz) < 170);

          if (hash2(cx - 2, cz + 1) > 0.55) {
            const annex = makeBox(towerWidth * 0.36, towerHeight * 0.35, towerDepth * 0.32, materials.buildingA);
            annex.position.set(cx - towerWidth * 0.22, towerHeight * 0.175 + 0.36, cz + towerDepth * 0.2);
            annex.castShadow = Math.abs(cx) < 170 && Math.abs(cz) < 170;
            annex.receiveShadow = true;
            scene.add(annex);
            addObstacle(cx - towerWidth * 0.22, cz + towerDepth * 0.2, towerWidth * 0.36, towerDepth * 0.32);
          }
        }
      }

      if (hash2(xMin, zMin) > 0.38) {
        const parked = createParkedCar(0x4b7fb5, 0.95);
        parked.position.set(innerMinX + 9, 0, zMax - 7);
        parked.rotation.y = Math.PI * 0.5;
        scene.add(parked);
        addParkedCarObstacle(parked.position.x, parked.position.z, parked.rotation.y, 0.95);
      }
      if (hash2(xMax, zMax) > 0.52) {
        const parked = createParkedCar(0xdddddd, 0.98);
        parked.position.set(xMax - 7, 0, innerMinZ + 10);
        parked.rotation.y = Math.PI;
        scene.add(parked);
        addParkedCarObstacle(parked.position.x, parked.position.z, parked.rotation.y, 0.98);
      }
    }
  }
}

// ------------------------------------------------------------
// Traffic
// ------------------------------------------------------------
function createTrafficCarMesh(color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.6 });

  const body = makeBox(1.9, 0.52, 4.15, paint);
  body.position.y = 0.9;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cabin = makeBox(1.55, 0.52, 1.85, materials.glass);
  cabin.position.set(0, 1.28, -0.12);
  cabin.castShadow = true;
  group.add(cabin);

  const bumper = makeBox(1.82, 0.14, 0.22, materials.metalDark);
  bumper.position.set(0, 0.76, 2.06);
  group.add(bumper);

  const rear = bumper.clone();
  rear.position.z = -2.06;
  group.add(rear);

  const wheelGeometry = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
  const wheelPositions = [
    [-0.94, 0.4, 1.24],
    [0.94, 0.4, 1.24],
    [-0.94, 0.4, -1.24],
    [0.94, 0.4, -1.24]
  ];

  for (const [x, y, z] of wheelPositions) {
    const tire = new THREE.Mesh(wheelGeometry, materials.tire);
    tire.rotation.z = Math.PI * 0.5;
    tire.position.set(x, y, z);
    tire.castShadow = true;
    group.add(tire);
  }

  return group;
}

function spawnTrafficCar(axis, lane, dir, scalar, speed, color) {
  const mesh = createTrafficCarMesh(color);
  scene.add(mesh);
  const traffic = {
    axis,
    lane,
    dir,
    scalar,
    speed,
    cruiseSpeed: speed,
    targetSpeed: speed,
    width: 1.95,
    length: 4.2,
    mesh,
    wheelSpin: 0
  };
  trafficCars.push(traffic);
  updateTrafficCarTransform(traffic);
}

function buildTrafficSystem() {
  const palette = [0x2f80ed, 0xffffff, 0xe63946, 0x2a9d8f, 0xadb5bd, 0x222831, 0xd4a373];
  let colorIndex = 0;

  for (const x of roadCenters) {
    for (const laneOffset of laneOffsets) {
      const laneX = x + laneOffset;
      const dir = laneOffset < 0 ? 1 : -1;
      for (let i = 0; i < 2; i++) {
        const scalar = -worldHalf + 60 + (i * 170) + hash2(laneX, i) * 50;
        spawnTrafficCar('z', laneX, dir, scalar, 10 + hash2(laneX, scalar) * 6, palette[colorIndex++ % palette.length]);
      }
    }
  }

  for (const z of roadCenters) {
    for (const laneOffset of laneOffsets) {
      const laneZ = z + laneOffset;
      const dir = laneOffset < 0 ? -1 : 1;
      for (let i = 0; i < 2; i++) {
        const scalar = -worldHalf + 40 + (i * 180) + hash2(laneZ, i + 10) * 55;
        spawnTrafficCar('x', laneZ, dir, scalar, 10 + hash2(laneZ, scalar) * 6, palette[colorIndex++ % palette.length]);
      }
    }
  }
}

function updateTrafficCarTransform(car) {
  if (car.axis === 'z') {
    car.mesh.position.set(car.lane, 0.02, car.scalar);
    car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
  } else {
    car.mesh.position.set(car.scalar, 0.02, car.lane);
    car.mesh.rotation.y = car.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
  }
}

function getTrafficAABB(car) {
  if (car.axis === 'z') {
    return { x: car.lane, z: car.scalar, halfW: car.width * 0.6, halfD: car.length * 0.58 };
  }
  return { x: car.scalar, z: car.lane, halfW: car.length * 0.58, halfD: car.width * 0.6 };
}

function getTrafficSignalPhase() {
  const cycleTime = trafficSignalState.elapsed % trafficSignalState.totalCycle;
  const zGreenEnd = trafficSignalState.zGreenDuration;
  const zAmberEnd = zGreenEnd + trafficSignalState.amberDuration;
  const firstAllRedEnd = zAmberEnd + trafficSignalState.allRedDuration;
  const xGreenEnd = firstAllRedEnd + trafficSignalState.xGreenDuration;
  const xAmberEnd = xGreenEnd + trafficSignalState.amberDuration;

  if (cycleTime < zGreenEnd) return { z: 'green', x: 'red' };
  if (cycleTime < zAmberEnd) return { z: 'amber', x: 'red' };
  if (cycleTime < firstAllRedEnd) return { z: 'red', x: 'red' };
  if (cycleTime < xGreenEnd) return { z: 'red', x: 'green' };
  if (cycleTime < xAmberEnd) return { z: 'red', x: 'amber' };
  return { z: 'red', x: 'red' };
}

function updateTrafficSignalVisuals() {
  const phase = getTrafficSignalPhase();
  for (const visual of trafficLightVisuals) {
    const state = phase[visual.controlledAxis];
    visual.red.material.emissiveIntensity = state === 'red' ? 1.4 : 0.06;
    visual.amber.material.emissiveIntensity = state === 'amber' ? 1.2 : 0.04;
    visual.green.material.emissiveIntensity = state === 'green' ? 1.1 : 0.04;
  }
}

function getTrafficStopDistance(car, axisPhase) {
  if (axisPhase === 'green') return Infinity;

  let nearest = Infinity;
  for (const center of roadCenters) {
    const stopScalar = center - car.dir * (roadHalf + 4.5);
    const distance = (stopScalar - car.scalar) * car.dir;
    if (distance > 0.8 && distance < nearest) nearest = distance;
  }
  return nearest;
}

function updateTraffic(dt) {
  trafficSignalState.elapsed += dt;
  updateTrafficSignalVisuals();

  const laneGroups = new Map();
  for (const car of trafficCars) {
    const key = `${car.axis}:${car.lane.toFixed(1)}:${car.dir}`;
    if (!laneGroups.has(key)) laneGroups.set(key, []);
    laneGroups.get(key).push(car);
  }

  for (const cars of laneGroups.values()) {
    cars.sort((a, b) => a.scalar - b.scalar);
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      let gap = Infinity;
      for (let j = 0; j < cars.length; j++) {
        if (i === j) continue;
        const other = cars[j];
        const delta = (other.scalar - car.scalar) * car.dir;
        const wrapped = delta <= 0 ? delta + (worldHalf * 2 + 40) : delta;
        if (wrapped > 0 && wrapped < gap) gap = wrapped;
      }

      let desiredSpeed = car.cruiseSpeed;
      if (gap < 12) desiredSpeed = 0;
      else if (gap < 18) desiredSpeed = Math.min(desiredSpeed, 2.0);
      else if (gap < 26) desiredSpeed = Math.min(desiredSpeed, car.targetSpeed * 0.45);
      else if (gap < 36) desiredSpeed = Math.min(desiredSpeed, car.targetSpeed * 0.72);

      const axisPhase = getTrafficSignalPhase()[car.axis];
      const stopDistance = getTrafficStopDistance(car, axisPhase);
      if (stopDistance < 4.5) desiredSpeed = 0;
      else if (stopDistance < 10) desiredSpeed = Math.min(desiredSpeed, 1.2);
      else if (stopDistance < 18) desiredSpeed = Math.min(desiredSpeed, 3.0);
      else if (stopDistance < 28) desiredSpeed = Math.min(desiredSpeed, 5.5);
      else if (stopDistance < 40) desiredSpeed = Math.min(desiredSpeed, 8.5);

      car.targetSpeed = desiredSpeed;
    }
  }

  for (const car of trafficCars) {
    car.speed = damp(car.speed, car.targetSpeed, 2.8, dt);
    car.scalar += car.dir * car.speed * dt;
    if (car.scalar > worldHalf + 20) car.scalar = -worldHalf - 20;
    if (car.scalar < -worldHalf - 20) car.scalar = worldHalf + 20;
    car.wheelSpin += car.speed * dt / 0.38;
    updateTrafficCarTransform(car);
  }
}

// ------------------------------------------------------------
// Player car
// ------------------------------------------------------------
function createPlayerCar() {
  const root = new THREE.Group();
  const tiltRig = new THREE.Group();
  const steeringRigFrontLeft = new THREE.Group();
  const steeringRigFrontRight = new THREE.Group();
  root.add(tiltRig);

  const body = makeBox(1.92, 0.52, 4.26, materials.carPaint);
  body.position.y = 0.96;
  body.castShadow = true;
  body.receiveShadow = true;
  tiltRig.add(body);

  const hood = makeBox(1.78, 0.16, 1.2, materials.carPaint);
  hood.position.set(0, 1.15, 1.38);
  hood.castShadow = true;
  tiltRig.add(hood);

  const cabin = makeBox(1.56, 0.65, 1.95, materials.glass);
  cabin.position.set(0, 1.38, -0.12);
  cabin.castShadow = true;
  tiltRig.add(cabin);

  const rearGlass = makeBox(1.48, 0.1, 0.78, materials.glass);
  rearGlass.position.set(0, 1.28, -1.02);
  rearGlass.rotation.x = -0.45;
  tiltRig.add(rearGlass);

  const windshield = makeBox(1.48, 0.1, 0.88, materials.glass);
  windshield.position.set(0, 1.28, 0.58);
  windshield.rotation.x = 0.5;
  tiltRig.add(windshield);

  const sideSkirtLeft = makeBox(0.1, 0.18, 3.2, materials.metalDark);
  sideSkirtLeft.position.set(-0.98, 0.65, 0);
  tiltRig.add(sideSkirtLeft);

  const sideSkirtRight = sideSkirtLeft.clone();
  sideSkirtRight.position.x = 0.98;
  tiltRig.add(sideSkirtRight);

  const frontBumper = makeBox(1.86, 0.22, 0.32, materials.metalDark);
  frontBumper.position.set(0, 0.76, 2.08);
  tiltRig.add(frontBumper);

  const rearBumper = frontBumper.clone();
  rearBumper.position.z = -2.08;
  tiltRig.add(rearBumper);

  const spoiler = makeBox(1.24, 0.08, 0.3, materials.metalDark);
  spoiler.position.set(0, 1.52, -1.92);
  tiltRig.add(spoiler);

  const headlightGeometry = new THREE.BoxGeometry(0.34, 0.13, 0.08);
  const headlightLeft = new THREE.Mesh(headlightGeometry, materials.lightOn);
  headlightLeft.position.set(-0.58, 0.96, 2.17);
  tiltRig.add(headlightLeft);

  const headlightRight = headlightLeft.clone();
  headlightRight.position.x = 0.58;
  tiltRig.add(headlightRight);

  const rearLightLeft = new THREE.Mesh(headlightGeometry, materials.lightRed);
  rearLightLeft.position.set(-0.58, 0.94, -2.17);
  tiltRig.add(rearLightLeft);

  const rearLightRight = rearLightLeft.clone();
  rearLightRight.position.x = 0.58;
  tiltRig.add(rearLightRight);

  const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18);
  const rimGeometry = new THREE.CylinderGeometry(0.23, 0.23, 0.32, 12);

  function createWheel() {
    const group = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeometry, materials.tire);
    tire.rotation.z = Math.PI * 0.5;
    tire.castShadow = true;
    tire.receiveShadow = true;
    group.add(tire);

    const rim = new THREE.Mesh(rimGeometry, materials.wheel);
    rim.rotation.z = Math.PI * 0.5;
    group.add(rim);

    return group;
  }

  const rearLeft = createWheel();
  rearLeft.position.set(-1.03, 0.42, -1.38);
  tiltRig.add(rearLeft);

  const rearRight = createWheel();
  rearRight.position.set(1.03, 0.42, -1.38);
  tiltRig.add(rearRight);

  steeringRigFrontLeft.position.set(-1.03, 0.42, 1.3);
  steeringRigFrontRight.position.set(1.03, 0.42, 1.3);
  tiltRig.add(steeringRigFrontLeft, steeringRigFrontRight);

  const frontLeft = createWheel();
  const frontRight = createWheel();
  steeringRigFrontLeft.add(frontLeft);
  steeringRigFrontRight.add(frontRight);

  const headlightL = new THREE.SpotLight(0xfff3d8, 14, 40, 0.38, 0.5, 2);
  headlightL.position.set(-0.58, 1.0, 1.92);
  headlightL.target.position.set(-0.58, 0.7, 12);
  tiltRig.add(headlightL, headlightL.target);

  const headlightR = new THREE.SpotLight(0xfff3d8, 14, 40, 0.38, 0.5, 2);
  headlightR.position.set(0.58, 1.0, 1.92);
  headlightR.target.position.set(0.58, 0.7, 12);
  tiltRig.add(headlightR, headlightR.target);

  scene.add(root);

  return {
    root,
    tiltRig,
    wheels: {
      frontLeft,
      frontRight,
      rearLeft,
      rearRight,
      steeringRigFrontLeft,
      steeringRigFrontRight
    }
  };
}

const playerCar = createPlayerCar();

function createHumanoidMesh(scale = 1, palette = {}) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: palette.skin || 0xc89273, roughness: 0.92 });
  const jacket = new THREE.MeshStandardMaterial({ color: palette.jacket || 0x33495f, roughness: 0.88 });
  const pants = new THREE.MeshStandardMaterial({ color: palette.pants || 0x252a33, roughness: 0.95 });
  const shoes = new THREE.MeshStandardMaterial({ color: palette.shoes || 0x111111, roughness: 0.98 });
  const hair = new THREE.MeshStandardMaterial({ color: palette.hair || 0x2a221d, roughness: 0.9 });

  const pelvis = new THREE.Group();
  group.add(pelvis);

  const hips = makeBox(0.48, 0.26, 0.26, jacket);
  hips.position.y = 1.0;
  pelvis.add(hips);

  const torso = makeBox(0.62, 0.82, 0.34, jacket);
  torso.position.y = 1.58;
  pelvis.add(torso);

  const chest = makeBox(0.5, 0.22, 0.36, new THREE.MeshStandardMaterial({ color: palette.trim || 0x5b6f86, roughness: 0.85 }));
  chest.position.set(0, 1.66, 0.18);
  pelvis.add(chest);

  const neck = makeBox(0.16, 0.12, 0.14, skin);
  neck.position.y = 2.06;
  pelvis.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), skin);
  head.position.y = 2.34;
  pelvis.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.y = 2.42;
  pelvis.add(hairCap);

  const shoulderL = new THREE.Group();
  shoulderL.position.set(-0.39, 1.92, 0);
  pelvis.add(shoulderL);
  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.39, 1.92, 0);
  pelvis.add(shoulderR);

  const upperArmGeom = new THREE.CapsuleGeometry(0.095, 0.38, 4, 10);
  const lowerArmGeom = new THREE.CapsuleGeometry(0.08, 0.32, 4, 10);
  const thighGeom = new THREE.CapsuleGeometry(0.11, 0.48, 4, 10);
  const calfGeom = new THREE.CapsuleGeometry(0.095, 0.46, 4, 10);

  const upperArmL = new THREE.Mesh(upperArmGeom, jacket);
  upperArmL.position.y = -0.26;
  upperArmL.rotation.z = Math.PI;
  shoulderL.add(upperArmL);
  const upperArmR = new THREE.Mesh(upperArmGeom, jacket);
  upperArmR.position.y = -0.26;
  upperArmR.rotation.z = Math.PI;
  shoulderR.add(upperArmR);

  const elbowL = new THREE.Group();
  elbowL.position.y = -0.52;
  shoulderL.add(elbowL);
  const elbowR = new THREE.Group();
  elbowR.position.y = -0.52;
  shoulderR.add(elbowR);

  const lowerArmL = new THREE.Mesh(lowerArmGeom, skin);
  lowerArmL.position.y = -0.24;
  lowerArmL.rotation.z = Math.PI;
  elbowL.add(lowerArmL);
  const lowerArmR = new THREE.Mesh(lowerArmGeom, skin);
  lowerArmR.position.y = -0.24;
  lowerArmR.rotation.z = Math.PI;
  elbowR.add(lowerArmR);

  const handL = makeBox(0.1, 0.12, 0.12, skin);
  handL.position.y = -0.47;
  elbowL.add(handL);
  const handR = makeBox(0.1, 0.12, 0.12, skin);
  handR.position.y = -0.47;
  elbowR.add(handR);

  const hipL = new THREE.Group();
  hipL.position.set(-0.16, 0.9, 0);
  pelvis.add(hipL);
  const hipR = new THREE.Group();
  hipR.position.set(0.16, 0.9, 0);
  pelvis.add(hipR);

  const thighL = new THREE.Mesh(thighGeom, pants);
  thighL.position.y = -0.34;
  thighL.rotation.z = Math.PI;
  hipL.add(thighL);
  const thighR = new THREE.Mesh(thighGeom, pants);
  thighR.position.y = -0.34;
  thighR.rotation.z = Math.PI;
  hipR.add(thighR);

  const kneeL = new THREE.Group();
  kneeL.position.y = -0.68;
  hipL.add(kneeL);
  const kneeR = new THREE.Group();
  kneeR.position.y = -0.68;
  hipR.add(kneeR);

  const calfL = new THREE.Mesh(calfGeom, pants);
  calfL.position.y = -0.32;
  calfL.rotation.z = Math.PI;
  kneeL.add(calfL);
  const calfR = new THREE.Mesh(calfGeom, pants);
  calfR.position.y = -0.32;
  calfR.rotation.z = Math.PI;
  kneeR.add(calfR);

  const footL = makeBox(0.14, 0.08, 0.28, shoes);
  footL.position.set(0, -0.68, 0.08);
  kneeL.add(footL);
  const footR = makeBox(0.14, 0.08, 0.28, shoes);
  footR.position.set(0, -0.68, 0.08);
  kneeR.add(footR);

  group.scale.setScalar(scale);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return {
    root: group,
    pelvis,
    shoulders: { left: shoulderL, right: shoulderR },
    elbows: { left: elbowL, right: elbowR },
    hips: { left: hipL, right: hipR },
    knees: { left: kneeL, right: kneeR },
    head
  };
}

const playerAvatar = createHumanoidMesh(0.92, {
  skin: 0xb98061,
  jacket: 0x2c4059,
  trim: 0x6e8fb2,
  pants: 0x20252f,
  shoes: 0x101214,
  hair: 0x251d17
});
scene.add(playerAvatar.root);
playerAvatar.root.visible = false;

const moveCursorMarker = new THREE.Group();
const moveCursorRing = new THREE.Mesh(
  new THREE.RingGeometry(0.48, 0.76, 24),
  new THREE.MeshBasicMaterial({ color: 0x8ff089, transparent: true, opacity: 0.92, side: THREE.DoubleSide })
);
moveCursorRing.rotation.x = -Math.PI * 0.5;
moveCursorMarker.add(moveCursorRing);

const moveCursorArrow = new THREE.Mesh(
  new THREE.ConeGeometry(0.22, 0.42, 12),
  new THREE.MeshStandardMaterial({ color: 0xa8ff9f, emissive: 0x5dbb54, emissiveIntensity: 0.4, roughness: 0.45 })
);
moveCursorArrow.position.y = 0.34;
moveCursorMarker.add(moveCursorArrow);
moveCursorMarker.visible = false;
scene.add(moveCursorMarker);

const pedestrianPalettes = [
  { skin: 0xd2a080, jacket: 0x5d748d, trim: 0x829db8, pants: 0x27303b, shoes: 0x121212, hair: 0x2f231b },
  { skin: 0x8f5d45, jacket: 0x6b5c7e, trim: 0x9d88b8, pants: 0x1c1f28, shoes: 0x121212, hair: 0x1e1714 },
  { skin: 0xc48d6b, jacket: 0x59735d, trim: 0x7fa282, pants: 0x252b30, shoes: 0x141414, hair: 0x36271f },
  { skin: 0x6f4635, jacket: 0x6b4b3f, trim: 0x9b7262, pants: 0x252a33, shoes: 0x111111, hair: 0x1a1412 }
];

const vehicle = {
  spawn: new THREE.Vector3(0, 0, 180),
  position: new THREE.Vector3(0, 0, 180),
  velocity: new THREE.Vector3(),
  heading: Math.PI,
  steer: 0,
  yawRate: 0,
  wheelSpin: 0,
  bodyRoll: 0,
  bodyPitch: 0,
  suspensionOffset: 0,
  suspensionVelocity: 0,
  lastForwardSpeed: 0,
  speedKmh: 0,
  gear: 'N',
  wheelBase: 2.65,
  length: 4.3,
  width: 1.95,
  engineForce: 24,
  brakeForce: 31,
  reverseForce: 15,
  rollingResistance: 1.9,
  aerodynamicDrag: 0.015,
  sideGrip: 12.5,
  sideGripHandbrake: 3.5,
  maxSteer: 0.53,
  steerSpeed: 5.4,
  steerCrossSpeed: 2.35,
  steerReturnSpeed: 6.0,
  yawResponse: 5.95
};

const playerState = {
  inVehicle: true,
  position: vehicle.spawn.clone().add(new THREE.Vector3(-2.1, 0, 0.8)),
  velocity: new THREE.Vector3(),
  heading: Math.PI,
  radius: 0.42,
  walkSpeed: 4.2,
  sprintSpeed: 8.4,
  cameraMode: 'third',
  walkCycle: 0,
  hornPulse: 0,
  moveTarget: new THREE.Vector3(),
  moveTargetActive: false,
  moveTargetRun: false
};

function getCarDoorPosition(side = 'left') {
  const right = vehicleRight();
  const offset = side === 'left' ? -1.45 : 1.45;
  return vehicle.position.clone().addScaledVector(right, offset).addScaledVector(vehicleForward(), -0.18);
}

function resetOnFootNearCar() {
  const candidates = [getCarDoorPosition('left'), getCarDoorPosition('right'), vehicle.position.clone().addScaledVector(vehicleForward(), -3.6)];
  for (const candidate of candidates) {
    const p = candidate.clone();
    if (!resolveCircleCollisions(p, playerState.radius, true) || p.distanceTo(candidate) < 0.6) {
      playerState.position.copy(p);
      playerState.velocity.set(0, 0, 0);
      clearMoveTarget();
      updatePlayerAvatar(0);
      return;
    }
  }
  playerState.position.copy(vehicle.position).add(new THREE.Vector3(0, 0, -4));
  playerState.velocity.set(0, 0, 0);
  clearMoveTarget();
  updatePlayerAvatar(0);
}

function enterVehicle() {
  if (vehicle.speedKmh > 2.5) return;
  clearMoveTarget();
  playerState.inVehicle = true;
  playerAvatar.root.visible = false;
  playerState.velocity.set(0, 0, 0);
  updateHud();
}

function exitVehicle() {
  const left = getCarDoorPosition('left');
  const rightPos = getCarDoorPosition('right');
  const options = [left, rightPos, vehicle.position.clone().addScaledVector(vehicleForward(), -3.6)];

  for (const option of options) {
    const p = option.clone();
    resolveCircleCollisions(p, playerState.radius, true);
    if (p.distanceTo(option) < 0.8) {
      playerState.position.copy(p);
      playerState.position.y = 0;
      playerState.heading = vehicle.heading + Math.PI * 0.5;
      playerState.velocity.set(0, 0, 0);
      clearMoveTarget();
      playerState.inVehicle = false;
      playerAvatar.root.visible = playerState.cameraMode === 'third';
      updatePlayerAvatar(0);
      updateHud();
      return;
    }
  }
}

function handleInteract() {
  if (!gameStarted) return;
  if (playerState.inVehicle) {
    if (vehicle.speedKmh < 3) exitVehicle();
    return;
  }
  const doorLeft = getCarDoorPosition('left');
  const doorRight = getCarDoorPosition('right');
  const nearDoor = Math.min(playerState.position.distanceTo(doorLeft), playerState.position.distanceTo(doorRight));
  if (nearDoor < 2.7 && vehicle.speedKmh < 3) enterVehicle();
}

function toggleCameraMode() {
  playerState.cameraMode = playerState.cameraMode === 'third' ? 'first' : 'third';
  if (!playerState.inVehicle) playerAvatar.root.visible = playerState.cameraMode === 'third';
  updateHud();
}

function resetVehicle() {
  vehicle.position.copy(vehicle.spawn);
  vehicle.velocity.set(0, 0, 0);
  vehicle.heading = Math.PI;
  vehicle.steer = 0;
  vehicle.yawRate = 0;
  vehicle.wheelSpin = 0;
  vehicle.bodyRoll = 0;
  vehicle.bodyPitch = 0;
  vehicle.suspensionOffset = 0;
  vehicle.suspensionVelocity = 0;
  vehicle.lastForwardSpeed = 0;
  updateCarModel();
}

function getCarOBB(x, z, heading) {
  const halfW = vehicle.width * 0.5;
  const halfL = vehicle.length * 0.5;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  return {
    center: { x, z },
    axes: [
      { x: sin, z: cos },
      { x: cos, z: -sin }
    ],
    extents: [halfL, halfW]
  };
}

function getPlayerCarAABB() {
  const halfL = vehicle.length * 0.5;
  const halfW = vehicle.width * 0.5;
  const sin = Math.abs(Math.sin(vehicle.heading));
  const cos = Math.abs(Math.cos(vehicle.heading));
  return {
    x: vehicle.position.x,
    z: vehicle.position.z,
    halfW: sin * halfL + cos * halfW,
    halfD: cos * halfL + sin * halfW
  };
}

function projectOBB(axis, obb) {
  const centerProjection = obb.center.x * axis.x + obb.center.z * axis.z;
  const radius =
    Math.abs(axis.x * obb.axes[0].x + axis.z * obb.axes[0].z) * obb.extents[0] +
    Math.abs(axis.x * obb.axes[1].x + axis.z * obb.axes[1].z) * obb.extents[1];
  return { min: centerProjection - radius, max: centerProjection + radius };
}

function projectAABB(axis, box) {
  const centerProjection = box.x * axis.x + box.z * axis.z;
  const radius = Math.abs(axis.x) * box.halfW + Math.abs(axis.z) * box.halfD;
  return { min: centerProjection - radius, max: centerProjection + radius };
}

function intervalsOverlap(a, b) {
  return !(a.max < b.min || b.max < a.min);
}

function getProjectionOverlap(a, b) {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min);
}

function obbIntersectsAABB(obb, box) {
  const axes = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    obb.axes[0],
    obb.axes[1]
  ];

  for (const axis of axes) {
    const projA = projectOBB(axis, obb);
    const projB = projectAABB(axis, box);
    if (!intervalsOverlap(projA, projB)) return false;
  }
  return true;
}

function getOBBAABBCollision(obb, box) {
  const axes = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    obb.axes[0],
    obb.axes[1]
  ];

  let minOverlap = Infinity;
  let bestAxis = null;

  for (const axis of axes) {
    const projA = projectOBB(axis, obb);
    const projB = projectAABB(axis, box);
    const overlap = getProjectionOverlap(projA, projB);
    if (overlap <= 0) return null;

    if (overlap < minOverlap) {
      const centerDelta = (obb.center.x - box.x) * axis.x + (obb.center.z - box.z) * axis.z;
      const direction = centerDelta >= 0 ? 1 : -1;
      minOverlap = overlap;
      bestAxis = { x: axis.x * direction, z: axis.z * direction };
    }
  }

  return { normal: bestAxis, penetration: minOverlap };
}

function getVehicleCollisionContacts(x, z, heading) {
  const obb = getCarOBB(x, z, heading);
  const contacts = [];

  for (const obstacle of obstacles) {
    const collision = getOBBAABBCollision(obb, obstacle);
    if (collision) contacts.push(collision);
  }

  for (const traffic of trafficCars) {
    const collision = getOBBAABBCollision(obb, getTrafficAABB(traffic));
    if (collision) contacts.push(collision);
  }

  return contacts;
}

function resolveVehicleCollisions() {
  let hit = false;
  let accumulatedNormalX = 0;
  let accumulatedNormalZ = 0;
  let strongestPenetration = 0;

  for (let iteration = 0; iteration < 5; iteration++) {
    const contacts = getVehicleCollisionContacts(vehicle.position.x, vehicle.position.z, vehicle.heading);
    if (!contacts.length) break;

    hit = true;
    let pushX = 0;
    let pushZ = 0;

    for (const contact of contacts) {
      const separation = contact.penetration + 0.012;
      pushX += contact.normal.x * separation;
      pushZ += contact.normal.z * separation;
      accumulatedNormalX += contact.normal.x * separation;
      accumulatedNormalZ += contact.normal.z * separation;
      strongestPenetration = Math.max(strongestPenetration, contact.penetration);
    }

    vehicle.position.x += pushX;
    vehicle.position.z += pushZ;
  }

  if (!hit) return false;

  let normalLength = Math.hypot(accumulatedNormalX, accumulatedNormalZ);
  let normalX = normalLength > 0.0001 ? accumulatedNormalX / normalLength : 0;
  let normalZ = normalLength > 0.0001 ? accumulatedNormalZ / normalLength : 0;

  if (normalLength <= 0.0001) {
    const speed = vehicle.velocity.length();
    if (speed > 0.001) {
      normalX = -vehicle.velocity.x / speed;
      normalZ = -vehicle.velocity.z / speed;
    } else {
      normalX = Math.sin(vehicle.heading);
      normalZ = Math.cos(vehicle.heading);
    }
  }

  const normalVelocity = vehicle.velocity.x * normalX + vehicle.velocity.z * normalZ;
  if (normalVelocity < 0) {
    const restitution = 0.1;
    vehicle.velocity.x -= (1 + restitution) * normalVelocity * normalX;
    vehicle.velocity.z -= (1 + restitution) * normalVelocity * normalZ;
  }

  const tangentX = -normalZ;
  const tangentZ = normalX;
  const tangentVelocity = vehicle.velocity.x * tangentX + vehicle.velocity.z * tangentZ;
  vehicle.velocity.x -= tangentX * tangentVelocity * 0.12;
  vehicle.velocity.z -= tangentZ * tangentVelocity * 0.12;

  const impactSpeed = Math.max(0, -normalVelocity);
  const reboundSpeed = clamp(impactSpeed * 0.18 + strongestPenetration * 7, 0.18, 1.6);
  vehicle.velocity.x += normalX * reboundSpeed;
  vehicle.velocity.z += normalZ * reboundSpeed;

  vehicle.steer *= 0.72;
  vehicle.bodyPitch = Math.max(vehicle.bodyPitch, 0.012 + Math.min(0.018, strongestPenetration * 0.07));
  vehicle.suspensionVelocity -= Math.min(0.08, strongestPenetration * 0.16);

  return true;
}

function updateVehicle(dt) {
  const forward = vehicleForward();
  const right = vehicleRight();

  const forwardSpeed = vehicle.velocity.dot(forward);
  const lateralSpeed = vehicle.velocity.dot(right);
  const absForwardSpeed = Math.abs(forwardSpeed);

  const speedFactor = clamp(absForwardSpeed / 35, 0, 1);
  const lowSpeedSteerBoost = lerp(1.18, 1.0, speedFactor);
  const targetSteer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steeringLimit = lerp(vehicle.maxSteer * lowSpeedSteerBoost, vehicle.maxSteer * 0.68, speedFactor);
  const desiredSteer = targetSteer * steeringLimit;
  const isDirectionFlip = targetSteer !== 0 && Math.sign(desiredSteer) !== Math.sign(vehicle.steer) && Math.abs(vehicle.steer) > 0.03;

  if (targetSteer !== 0) {
    const oppositeAmount = isDirectionFlip ? clamp(Math.abs(vehicle.steer) / Math.max(steeringLimit, 0.001), 0, 1) : 0;
    const crossTargetScale = lerp(0.46, 0.28, speedFactor) * lerp(1.0, 0.84, oppositeAmount);
    const steerTarget = isDirectionFlip ? desiredSteer * crossTargetScale : desiredSteer;
    const steerRate = isDirectionFlip
      ? lerp(vehicle.steerCrossSpeed * 0.96, vehicle.steerCrossSpeed * 0.72, speedFactor)
      : lerp(vehicle.steerSpeed * 1.18, vehicle.steerSpeed * 0.94, speedFactor);

    vehicle.steer = damp(vehicle.steer, steerTarget, steerRate, dt);

    if (isDirectionFlip && Math.abs(vehicle.steer) < steeringLimit * 0.22) {
      vehicle.steer = damp(vehicle.steer, desiredSteer, vehicle.steerSpeed * 0.82, dt);
    }
  } else {
    vehicle.steer = damp(vehicle.steer, 0, vehicle.steerReturnSpeed, dt);
  }

  let longitudinalForce = 0;

  if (input.accelerate) {
    if (forwardSpeed > -0.8) longitudinalForce += vehicle.engineForce;
    else longitudinalForce += vehicle.brakeForce;
  }

  if (input.brake) {
    if (forwardSpeed > 1.2) longitudinalForce -= vehicle.brakeForce;
    else longitudinalForce -= vehicle.reverseForce;
  }

  const passiveBrake = (!input.accelerate && !input.brake) ? vehicle.rollingResistance : 0;
  if (Math.abs(forwardSpeed) > 0.01) {
    longitudinalForce -= Math.sign(forwardSpeed) * passiveBrake;
  }
  longitudinalForce -= forwardSpeed * Math.abs(forwardSpeed) * vehicle.aerodynamicDrag;

  vehicle.velocity.addScaledVector(forward, longitudinalForce * dt);

  const grip = input.handbrake ? vehicle.sideGripHandbrake : vehicle.sideGrip;
  vehicle.velocity.addScaledVector(right, -lateralSpeed * Math.min(grip * dt, 1));

  vehicle.velocity.multiplyScalar(1 - clamp(dt * 0.065, 0, 0.065));

  const turnStrength = Math.tan(vehicle.steer) / vehicle.wheelBase;
  const turnAssist = lerp(0.56, 1.02, clamp(absForwardSpeed / 11, 0, 1));
  const rotationAssist = vehicle.steer * clamp(absForwardSpeed / 13, 0, 1) * 0.28;
  const targetYawRate = -forwardSpeed * turnStrength * turnAssist - Math.sign(forwardSpeed || 1) * rotationAssist;
  const yawResponse = lerp(vehicle.yawResponse * 1.02, vehicle.yawResponse * 0.92, speedFactor);
  vehicle.yawRate = damp(vehicle.yawRate, targetYawRate, yawResponse, dt);
  vehicle.heading += vehicle.yawRate * dt;

  const move = vehicle.velocity.clone().multiplyScalar(dt);
  const steps = clamp(Math.ceil(move.length() / 0.55), 1, 10);
  const stepX = move.x / steps;
  const stepZ = move.z / steps;

  for (let i = 0; i < steps; i++) {
    vehicle.position.x += stepX;
    vehicle.position.z += stepZ;
    resolveVehicleCollisions();
  }

  vehicle.position.x = clamp(vehicle.position.x, -worldHalf - 4, worldHalf + 4);
  vehicle.position.z = clamp(vehicle.position.z, -worldHalf - 4, worldHalf + 4);

  const currentForwardSpeed = vehicle.velocity.dot(vehicleForward());
  const forwardAccel = (currentForwardSpeed - vehicle.lastForwardSpeed) / Math.max(dt, 0.0001);
  vehicle.lastForwardSpeed = currentForwardSpeed;

  const targetRoll = clamp(-vehicle.steer * absForwardSpeed * 0.043 + lateralSpeed * 0.0035, -0.085, 0.085);
  const targetPitch = clamp(-forwardAccel * 0.0035, -0.05, 0.05);
  vehicle.bodyRoll = damp(vehicle.bodyRoll, targetRoll, 8.0, dt);
  vehicle.bodyPitch = damp(vehicle.bodyPitch, targetPitch, 7.0, dt);

  const suspensionTarget = clamp(Math.abs(lateralSpeed) * 0.0012 + Math.abs(forwardAccel) * 0.00024, 0, 0.024);
  vehicle.suspensionVelocity += (suspensionTarget - vehicle.suspensionOffset) * 26 * dt;
  vehicle.suspensionVelocity *= Math.exp(-11 * dt);
  vehicle.suspensionOffset += vehicle.suspensionVelocity * dt;
  vehicle.suspensionOffset = clamp(vehicle.suspensionOffset, 0, 0.026);

  vehicle.speedKmh = Math.abs(currentForwardSpeed) * 3.6;
  vehicle.wheelSpin += currentForwardSpeed * dt / 0.42;

  if (vehicle.speedKmh < 1.5 && !input.accelerate && !input.brake) {
    vehicle.gear = 'N';
  } else if (currentForwardSpeed > 0.5) {
    vehicle.gear = vehicle.speedKmh < 25 ? '1' : vehicle.speedKmh < 48 ? '2' : vehicle.speedKmh < 75 ? '3' : vehicle.speedKmh < 115 ? '4' : '5';
  } else {
    vehicle.gear = 'R';
  }

  updateCarModel();
  updateHud();
}

function updateCarModel() {
  playerCar.root.position.copy(vehicle.position);
  playerCar.root.position.y = 0.12;
  playerCar.root.rotation.y = vehicle.heading;

  playerCar.tiltRig.position.y = 0.16 - vehicle.suspensionOffset;
  playerCar.tiltRig.rotation.z = vehicle.bodyRoll;
  playerCar.tiltRig.rotation.x = vehicle.bodyPitch;

  playerCar.wheels.steeringRigFrontLeft.rotation.y = -vehicle.steer;
  playerCar.wheels.steeringRigFrontRight.rotation.y = -vehicle.steer;

  playerCar.wheels.frontLeft.rotation.x = vehicle.wheelSpin;
  playerCar.wheels.frontRight.rotation.x = vehicle.wheelSpin;
  playerCar.wheels.rearLeft.rotation.x = vehicle.wheelSpin;
  playerCar.wheels.rearRight.rotation.x = vehicle.wheelSpin;
}

function updateHud() {
  const speed = playerState.inVehicle ? Math.round(vehicle.speedKmh) : Math.round(playerState.velocity.length() * 3.6);
  speedValue.textContent = speed.toString();
  gearValue.textContent = playerState.inVehicle ? vehicle.gear : 'ON';
  modeValue.textContent = playerState.inVehicle ? 'Driving' : 'On foot';
  cameraValue.textContent = playerState.cameraMode === 'third' ? 'Third person' : 'First person';

  if (playerState.inVehicle) {
    interactionHint.textContent = vehicle.speedKmh < 3 ? 'E to exit car · C camera · H horn' : 'Slow down to exit · C camera · H horn';
  } else {
    const nearDoor = Math.min(playerState.position.distanceTo(getCarDoorPosition('left')), playerState.position.distanceTo(getCarDoorPosition('right')));
    interactionHint.textContent = nearDoor < 2.8 ? 'E to enter car · Shift sprint · Tap ground to move' : 'Tap the ground to move · Walk to your car and press E';
  }
}

function updatePlayerAvatar(dt) {
  playerAvatar.root.position.copy(playerState.position);
  playerAvatar.root.position.y = 0.02;
  playerAvatar.root.rotation.y = playerState.heading;
  if (playerState.inVehicle || playerState.cameraMode === 'first') {
    playerAvatar.root.visible = false;
    return;
  }

  playerAvatar.root.visible = true;
  const speed = playerState.velocity.length();
  playerState.walkCycle += dt * (speed > 0.1 ? speed * 4.3 : 0.8);
  const swing = Math.sin(playerState.walkCycle) * Math.min(0.7, speed * 0.18);
  const counter = Math.sin(playerState.walkCycle + Math.PI) * Math.min(0.7, speed * 0.18);

  playerAvatar.shoulders.left.rotation.x = swing;
  playerAvatar.shoulders.right.rotation.x = counter;
  playerAvatar.elbows.left.rotation.x = Math.max(0, -swing * 0.25);
  playerAvatar.elbows.right.rotation.x = Math.max(0, -counter * 0.25);
  playerAvatar.hips.left.rotation.x = counter;
  playerAvatar.hips.right.rotation.x = swing;
  playerAvatar.knees.left.rotation.x = Math.max(0, swing) * 0.55;
  playerAvatar.knees.right.rotation.x = Math.max(0, counter) * 0.55;
  playerAvatar.pelvis.position.y = 0.02 + Math.abs(Math.sin(playerState.walkCycle * 2)) * Math.min(0.05, speed * 0.012);
}

function createPedestrian(axis, lane, scalar, dir, paletteIndex = 0) {
  const avatar = createHumanoidMesh(0.88 + hash2(lane, scalar) * 0.16, pedestrianPalettes[paletteIndex % pedestrianPalettes.length]);
  scene.add(avatar.root);
  const pedestrian = {
    axis,
    lane,
    offset: 0,
    scalar,
    dir,
    speed: 0,
    targetSpeed: 1.1 + hash2(lane * 0.3, scalar * 0.2) * 0.95,
    panicTimer: 0,
    reaction: 0,
    walkCycle: hash2(scalar, lane) * Math.PI * 2,
    avatar,
    radius: 0.34,
    heading: axis === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5)
  };
  pedestrians.push(pedestrian);
  updatePedestrianTransform(pedestrian, 0);
}

function buildPedestrianSystem() {
  let paletteIndex = 0;
  for (const x of roadCenters) {
    const sidewalkOffsets = [-(roadHalf + 4.6), roadHalf + 4.6];
    for (const offset of sidewalkOffsets) {
      for (let i = 0; i < 3; i++) {
        const scalar = -worldHalf + 38 + i * 190 + hash2(x + offset, i + 20) * 42;
        createPedestrian('z', x + offset, scalar, i % 2 === 0 ? 1 : -1, paletteIndex++);
      }
    }
  }

  for (const z of roadCenters) {
    const sidewalkOffsets = [-(roadHalf + 4.6), roadHalf + 4.6];
    for (const offset of sidewalkOffsets) {
      for (let i = 0; i < 3; i++) {
        const scalar = -worldHalf + 52 + i * 180 + hash2(z + offset, i + 40) * 45;
        createPedestrian('x', z + offset, scalar, i % 2 === 0 ? 1 : -1, paletteIndex++);
      }
    }
  }
}

function getPedestrianWorldPosition(pedestrian) {
  if (pedestrian.axis === 'z') return new THREE.Vector3(pedestrian.lane + pedestrian.offset, 0, pedestrian.scalar);
  return new THREE.Vector3(pedestrian.scalar, 0, pedestrian.lane + pedestrian.offset);
}

function updatePedestrianTransform(pedestrian, dt) {
  const pos = getPedestrianWorldPosition(pedestrian);
  pedestrian.avatar.root.position.copy(pos);
  pedestrian.avatar.root.position.y = 0.02;
  pedestrian.avatar.root.rotation.y = pedestrian.heading;

  pedestrian.walkCycle += dt * (pedestrian.speed * 5 + 1.2);
  const swing = Math.sin(pedestrian.walkCycle) * Math.min(0.65, pedestrian.speed * 0.18);
  const counter = Math.sin(pedestrian.walkCycle + Math.PI) * Math.min(0.65, pedestrian.speed * 0.18);
  pedestrian.avatar.shoulders.left.rotation.x = swing;
  pedestrian.avatar.shoulders.right.rotation.x = counter;
  pedestrian.avatar.hips.left.rotation.x = counter;
  pedestrian.avatar.hips.right.rotation.x = swing;
  pedestrian.avatar.knees.left.rotation.x = Math.max(0, swing) * 0.45;
  pedestrian.avatar.knees.right.rotation.x = Math.max(0, counter) * 0.45;
  pedestrian.avatar.pelvis.position.y = 0.02 + Math.abs(Math.sin(pedestrian.walkCycle * 2)) * Math.min(0.04, pedestrian.speed * 0.012);
}

function updatePedestrians(dt) {
  const threatPos = playerState.inVehicle ? vehicle.position : playerState.position;
  const threatVelocity = playerState.inVehicle ? vehicle.velocity : playerState.velocity;
  const threatSpeed = threatVelocity.length();
  const hornInfluence = input.horn && playerState.inVehicle;

  for (const pedestrian of pedestrians) {
    const pos = getPedestrianWorldPosition(pedestrian);
    const dx = pos.x - threatPos.x;
    const dz = pos.z - threatPos.z;
    const dist = Math.hypot(dx, dz);

    if ((playerState.inVehicle && threatSpeed > 4.5 && dist < 16) || (hornInfluence && dist < 26) || (!playerState.inVehicle && dist < 2.2)) {
      pedestrian.panicTimer = Math.max(pedestrian.panicTimer, hornInfluence ? 2.5 : 1.8);
      pedestrian.reaction = 1;
      if (pedestrian.axis === 'z') {
        const push = dx >= 0 ? 1 : -1;
        pedestrian.offset = damp(pedestrian.offset, push * 1.45, 4.8, dt);
        if (Math.abs(dz) > 2) pedestrian.dir = dz >= 0 ? 1 : -1;
      } else {
        const push = dz >= 0 ? 1 : -1;
        pedestrian.offset = damp(pedestrian.offset, push * 1.45, 4.8, dt);
        if (Math.abs(dx) > 2) pedestrian.dir = dx >= 0 ? 1 : -1;
      }
    } else {
      pedestrian.reaction = damp(pedestrian.reaction, 0, 1.8, dt);
      pedestrian.offset = damp(pedestrian.offset, 0, 1.7, dt);
    }

    pedestrian.panicTimer = Math.max(0, pedestrian.panicTimer - dt);
    const desiredSpeed = pedestrian.panicTimer > 0 ? 3.4 : pedestrian.targetSpeed;
    pedestrian.speed = damp(pedestrian.speed, desiredSpeed, pedestrian.panicTimer > 0 ? 4.5 : 2.4, dt);
    pedestrian.scalar += pedestrian.dir * pedestrian.speed * dt;

    if (pedestrian.scalar > worldHalf - 18) {
      pedestrian.scalar = worldHalf - 18;
      pedestrian.dir = -1;
    }
    if (pedestrian.scalar < -worldHalf + 18) {
      pedestrian.scalar = -worldHalf + 18;
      pedestrian.dir = 1;
    }

    if (pedestrian.axis === 'z') {
      pedestrian.heading = pedestrian.dir > 0 ? 0 : Math.PI;
    } else {
      pedestrian.heading = pedestrian.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    }

    const updatedPos = getPedestrianWorldPosition(pedestrian);
    const playerDx = updatedPos.x - playerState.position.x;
    const playerDz = updatedPos.z - playerState.position.z;
    const overlap = pedestrian.radius + playerState.radius - Math.hypot(playerDx, playerDz);
    if (!playerState.inVehicle && overlap > 0) {
      const n = Math.hypot(playerDx, playerDz) || 1;
      const nx = playerDx / n;
      const nz = playerDz / n;
      pedestrian.offset += (pedestrian.axis === 'z' ? nx : nz) * overlap * 0.8;
      playerState.position.x -= nx * overlap * 0.5;
      playerState.position.z -= nz * overlap * 0.5;
    }

    updatePedestrianTransform(pedestrian, dt);
  }
}

function updateOnFoot(dt) {
  const cameraForward = new THREE.Vector3();
  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  if (cameraForward.lengthSq() < 1e-6) cameraForward.set(Math.sin(playerState.heading), 0, Math.cos(playerState.heading));
  cameraForward.normalize();
  const cameraRight = new THREE.Vector3(cameraForward.z, 0, -cameraForward.x);

  const inputForward = (input.accelerate ? 1 : 0) + (input.brake ? -1 : 0);
  const inputRight = (input.right ? 1 : 0) + (input.left ? -1 : 0);
  const desiredMove = new THREE.Vector3();
  desiredMove.addScaledVector(cameraForward, inputForward);
  desiredMove.addScaledVector(cameraRight, inputRight);

  let targetSpeed = 0;
  const hasManualInput = desiredMove.lengthSq() > 1e-4;

  if (hasManualInput) {
    desiredMove.normalize();
    targetSpeed = input.sprint ? playerState.sprintSpeed : playerState.walkSpeed;
    clearMoveTarget();
  } else if (playerState.moveTargetActive) {
    const toTarget = playerState.moveTarget.clone().sub(playerState.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance <= 0.7) {
      clearMoveTarget();
    } else {
      desiredMove.copy(toTarget.normalize());
      targetSpeed = (input.sprint || playerState.moveTargetRun || distance > 16)
        ? playerState.sprintSpeed
        : playerState.walkSpeed;
      moveCursorMarker.position.set(playerState.moveTarget.x, 0.12 + Math.sin(performance.now() * 0.01) * 0.03, playerState.moveTarget.z);
      moveCursorMarker.rotation.y += dt * 2.4;
    }
  }

  const desiredVelocity = desiredMove.multiplyScalar(targetSpeed);
  playerState.velocity.lerp(desiredVelocity, 1 - Math.exp(-(targetSpeed > 0 ? 12 : 10) * dt));

  const delta = playerState.velocity.clone().multiplyScalar(dt);
  playerState.position.add(delta);
  resolveCircleCollisions(playerState.position, playerState.radius, true);

  if (playerState.velocity.lengthSq() > 0.02) {
    playerState.heading = Math.atan2(playerState.velocity.x, playerState.velocity.z);
  }

  updatePlayerAvatar(dt);
  updateHud();
}

// ------------------------------------------------------------
// Missions
// ------------------------------------------------------------
const missionMarker = new THREE.Group();
const missionRing = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.36, 12, 32), materials.missionRing);
missionRing.rotation.x = Math.PI * 0.5;
missionMarker.add(missionRing);
const missionBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 22, 20, 1, true), materials.missionBeam);
missionBeam.position.y = 11;
missionMarker.add(missionBeam);
scene.add(missionMarker);
missionMarker.visible = false;

const missionDefinitions = [
  {
    type: 'route',
    title: 'Downtown Sprint',
    description: 'Run the downtown line and hit each checkpoint in order.',
    timeLimit: 105,
    checkpointLabels: ['Start Gate', 'West Block', 'South Turn', 'Return Gate'],
    checkpoints: [
      new THREE.Vector3(0, 0, 90),
      new THREE.Vector3(-120, 0, 90),
      new THREE.Vector3(-120, 0, -30),
      new THREE.Vector3(0, 0, -30)
    ]
  },
  {
    type: 'delivery',
    title: 'Courier Shift',
    description: 'Pick up the parcel downtown, then deliver it to the north blocks.',
    timeLimit: 118,
    checkpointLabels: ['Pickup', 'Cut Across', 'Drop-off'],
    checkpoints: [
      new THREE.Vector3(-120, 0, 90),
      new THREE.Vector3(0, 0, 90),
      new THREE.Vector3(120, 0, 210)
    ]
  },
  {
    type: 'speedTrap',
    title: 'Boulevard Speed Trap',
    description: 'Build speed on the avenue and hit the camera fast enough.',
    timeLimit: 82,
    minSpeedKmh: 72,
    checkpointLabels: ['Approach', 'Speed Trap'],
    checkpoints: [
      new THREE.Vector3(-240, 0, -30),
      new THREE.Vector3(120, 0, -30)
    ]
  },
  {
    type: 'precisionStop',
    title: 'Precision Parking',
    description: 'Slide into the marked bay and stop the car cleanly inside the zone.',
    timeLimit: 70,
    maxEntrySpeedKmh: 8,
    checkpointLabels: ['Parking Bay'],
    checkpoints: [
      new THREE.Vector3(240, 0, 90)
    ]
  },
  {
    type: 'route',
    title: 'Ring Road Run',
    description: 'Complete the long perimeter route cleanly.',
    timeLimit: 170,
    checkpointLabels: ['North-East', 'North-West', 'South-West', 'South-East'],
    checkpoints: [
      new THREE.Vector3(240, 0, 240),
      new THREE.Vector3(-240, 0, 240),
      new THREE.Vector3(-240, 0, -240),
      new THREE.Vector3(240, 0, -240)
    ]
  },
  {
    type: 'route',
    title: 'City Grand Tour',
    description: 'String together a full cross-city run without wasting time.',
    timeLimit: 188,
    checkpointLabels: ['East Gate', 'Central Square', 'West Dip', 'North Lift', 'Finish'],
    checkpoints: [
      new THREE.Vector3(240, 0, 120),
      new THREE.Vector3(120, 0, 0),
      new THREE.Vector3(-120, 0, -120),
      new THREE.Vector3(-120, 0, 120),
      new THREE.Vector3(0, 0, 240)
    ]
  }
];

const missionState = {
  currentMissionIndex: 0,
  currentCheckpointIndex: 0,
  active: false,
  completedLoopCount: 0,
  timeLeft: 0,
  checkpointCooldown: 0,
  message: 'Press Play to start driving.'
};

function getCurrentMission() {
  return missionDefinitions[missionState.currentMissionIndex];
}

function getCurrentCheckpoint() {
  return getCurrentMission().checkpoints[missionState.currentCheckpointIndex];
}

function getCurrentCheckpointLabel() {
  const mission = getCurrentMission();
  return mission.checkpointLabels?.[missionState.currentCheckpointIndex] || `Checkpoint ${missionState.currentCheckpointIndex + 1}`;
}

function getMissionRequirementText(mission) {
  if (mission.type === 'speedTrap') return `Hit the trap at ${mission.minSpeedKmh}+ km/h`;
  if (mission.type === 'precisionStop') return `Enter under ${mission.maxEntrySpeedKmh} km/h`;
  if (mission.type === 'delivery') return 'Keep the line clean and make the drop on time';
  return 'Stay clean and keep the route flowing';
}

function startMission(index, introMessage = null) {
  const mission = missionDefinitions[index % missionDefinitions.length];
  missionState.currentMissionIndex = index % missionDefinitions.length;
  missionState.currentCheckpointIndex = 0;
  missionState.active = true;
  missionState.timeLeft = mission.timeLimit;
  missionState.checkpointCooldown = 0;
  missionState.message = introMessage || mission.description;
  missionMarker.visible = true;
  placeMissionMarker();
  updateMissionHud();
}

function placeMissionMarker() {
  const checkpoint = getCurrentCheckpoint();
  missionMarker.position.set(checkpoint.x, 0.4, checkpoint.z);
}

function completeMission(completionText) {
  let nextIndex = (missionState.currentMissionIndex + 1) % missionDefinitions.length;
  if (nextIndex === 0) missionState.completedLoopCount += 1;
  const nextMission = missionDefinitions[nextIndex];
  startMission(nextIndex, `${completionText} ${nextMission.description}`);
}

function advanceMission(stageMessage = null) {
  const mission = getCurrentMission();
  missionState.currentCheckpointIndex += 1;
  missionState.checkpointCooldown = 0.45;

  if (missionState.currentCheckpointIndex >= mission.checkpoints.length) {
    const completionText = mission.type === 'delivery'
      ? 'Delivery complete. Next contract loaded.'
      : mission.type === 'precisionStop'
        ? 'Parking job complete. New mission loaded.'
        : mission.type === 'speedTrap'
          ? 'Speed trap cleared. New challenge loaded.'
          : 'Route complete. Next mission loaded.';
    completeMission(completionText);
    return;
  }

  missionState.message = stageMessage || mission.description;
  placeMissionMarker();
  updateMissionHud();
}

function failMission(reason = 'Time expired. Mission restarted.') {
  startMission(missionState.currentMissionIndex, reason);
}

function updateMission(dt) {
  if (!missionState.active) return;

  const mission = getCurrentMission();
  const checkpoint = getCurrentCheckpoint();
  const dx = checkpoint.x - vehicle.position.x;
  const dz = checkpoint.z - vehicle.position.z;
  const distance = Math.hypot(dx, dz);

  missionState.timeLeft -= dt;
  missionState.checkpointCooldown = Math.max(0, missionState.checkpointCooldown - dt);
  if (missionState.timeLeft <= 0) {
    failMission();
    return;
  }

  missionRing.rotation.z += dt * 0.85;
  missionBeam.material.opacity = 0.16 + (Math.sin(performance.now() * 0.004) * 0.04 + 0.04);

  if (distance < 8.5 && missionState.checkpointCooldown <= 0) {
    if (mission.type === 'speedTrap' && missionState.currentCheckpointIndex === mission.checkpoints.length - 1) {
      if (vehicle.speedKmh >= mission.minSpeedKmh) {
        advanceMission(`Speed trap hit at ${Math.round(vehicle.speedKmh)} km/h.`);
      } else {
        missionState.message = `Too slow. Need ${mission.minSpeedKmh} km/h, you had ${Math.round(vehicle.speedKmh)} km/h.`;
        missionState.checkpointCooldown = 0.7;
      }
    } else if (mission.type === 'precisionStop') {
      if (vehicle.speedKmh <= mission.maxEntrySpeedKmh) {
        advanceMission(`Clean park at ${Math.round(vehicle.speedKmh)} km/h.`);
      } else {
        missionState.message = `Slow it down. Enter the bay under ${mission.maxEntrySpeedKmh} km/h.`;
        missionState.checkpointCooldown = 0.7;
      }
    } else {
      advanceMission(`${getCurrentCheckpointLabel()} reached.`);
    }
    return;
  }

  updateMissionHud(distance);
}

function updateMissionHud(distance = null) {
  if (!missionState.active) {
    missionTitle.textContent = 'Get rolling';
    missionText.textContent = missionState.message;
    missionMeta.textContent = 'Checkpoint —';
    return;
  }

  const mission = getCurrentMission();
  const checkpointLabel = getCurrentCheckpointLabel();
  missionTitle.textContent = mission.title;
  missionText.textContent = missionState.message || mission.description;

  const checkpointIndex = missionState.currentCheckpointIndex + 1;
  const checkpointText = `${checkpointLabel} ${checkpointIndex}/${mission.checkpoints.length}`;
  const distanceText = distance == null ? '--' : `${Math.round(distance)} m`;
  const requirementText = getMissionRequirementText(mission);
  missionMeta.textContent = `${checkpointText} · ${distanceText} · ${requirementText} · ${missionState.timeLeft.toFixed(0)}s`;
}

// ------------------------------------------------------------
// Camera
// ------------------------------------------------------------
const cameraState = {
  currentPosition: new THREE.Vector3(0, 5, 10),
  currentTarget: new THREE.Vector3()
};

function updateCamera(dt) {
  let desiredPosition;
  let desiredTarget;

  if (playerState.inVehicle) {
    const forward = vehicleForward();
    const speedFactor = clamp(vehicle.speedKmh / 140, 0, 1);
    if (playerState.cameraMode === 'first') {
      desiredPosition = vehicle.position.clone()
        .addScaledVector(forward, 0.92)
        .addScaledVector(vehicleRight(), vehicle.steer * 0.08)
        .add(new THREE.Vector3(0, 1.45, 0));
      desiredTarget = desiredPosition.clone()
        .addScaledVector(forward, 14)
        .add(new THREE.Vector3(0, 0.15, 0));
    } else {
      const height = lerp(4.6, 5.7, speedFactor);
      const distance = lerp(8.8, 11.8, speedFactor);
      const sideBias = vehicle.steer * 1.1;
      const lookAhead = lerp(4.8, 8.8, speedFactor);
      desiredPosition = vehicle.position.clone()
        .addScaledVector(forward, -distance)
        .addScaledVector(vehicleRight(), sideBias)
        .add(new THREE.Vector3(0, height, 0));
      desiredTarget = vehicle.position.clone()
        .addScaledVector(forward, lookAhead)
        .add(new THREE.Vector3(0, 1.15, 0));
    }
  } else {
    const forward = new THREE.Vector3(Math.sin(playerState.heading), 0, Math.cos(playerState.heading));
    const right = new THREE.Vector3(Math.cos(playerState.heading), 0, -Math.sin(playerState.heading));
    if (playerState.cameraMode === 'first') {
      desiredPosition = playerState.position.clone().add(new THREE.Vector3(0, 1.64, 0));
      desiredTarget = desiredPosition.clone().addScaledVector(forward, 12);
    } else {
      desiredPosition = playerState.position.clone()
        .addScaledVector(forward, -4.3)
        .addScaledVector(right, 0.35)
        .add(new THREE.Vector3(0, 2.1, 0));
      desiredTarget = playerState.position.clone()
        .addScaledVector(forward, 3.8)
        .add(new THREE.Vector3(0, 1.25, 0));
    }
  }

  cameraState.currentPosition.lerp(desiredPosition, 1 - Math.exp(-6.2 * dt));
  cameraState.currentTarget.lerp(desiredTarget, 1 - Math.exp(-7.0 * dt));

  camera.position.copy(cameraState.currentPosition);
  camera.lookAt(cameraState.currentTarget);
}

// ------------------------------------------------------------
// Mini map
// ------------------------------------------------------------
function mapWorldToMinimap(x, z, originX, originZ, scale) {
  return {
    x: minimapCanvas.width * 0.5 + (x - originX) * scale,
    y: minimapCanvas.height * 0.5 + (z - originZ) * scale
  };
}

function drawMinimap() {
  const ctx = minimapCtx;
  const width = minimapCanvas.width;
  const height = minimapCanvas.height;
  const focus = getActiveFocusPosition();
  const scale = width / (minimapRange * 2);
  const originX = focus.x;
  const originZ = focus.z;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#061019';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 4; i++) {
    const inset = i * width * 0.12;
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
  }

  ctx.fillStyle = '#1d242c';
  for (const x of roadCenters) {
    const topLeft = mapWorldToMinimap(x - roadHalf, -worldHalf, originX, originZ, scale);
    const bottomRight = mapWorldToMinimap(x + roadHalf, worldHalf, originX, originZ, scale);
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  }
  for (const z of roadCenters) {
    const topLeft = mapWorldToMinimap(-worldHalf, z - roadHalf, originX, originZ, scale);
    const bottomRight = mapWorldToMinimap(worldHalf, z + roadHalf, originX, originZ, scale);
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  }

  ctx.fillStyle = 'rgba(226,234,242,0.4)';
  for (const obstacle of obstacles) {
    if (Math.abs(obstacle.x - originX) > minimapRange + obstacle.halfW || Math.abs(obstacle.z - originZ) > minimapRange + obstacle.halfD) continue;
    const p = mapWorldToMinimap(obstacle.x - obstacle.halfW, obstacle.z - obstacle.halfD, originX, originZ, scale);
    const p2 = mapWorldToMinimap(obstacle.x + obstacle.halfW, obstacle.z + obstacle.halfD, originX, originZ, scale);
    ctx.fillRect(p.x, p.y, Math.max(1, p2.x - p.x), Math.max(1, p2.y - p.y));
  }

  ctx.fillStyle = '#ffcc5d';
  for (const car of trafficCars) {
    const posX = car.axis === 'x' ? car.scalar : car.lane;
    const posZ = car.axis === 'z' ? car.scalar : car.lane;
    if (Math.abs(posX - originX) > minimapRange || Math.abs(posZ - originZ) > minimapRange) continue;
    const p = mapWorldToMinimap(posX, posZ, originX, originZ, scale);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, width * 0.011), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(147, 199, 255, 0.82)';
  for (const pedestrian of pedestrians) {
    const pos = getPedestrianWorldPosition(pedestrian);
    if (Math.abs(pos.x - originX) > minimapRange || Math.abs(pos.z - originZ) > minimapRange) continue;
    const p = mapWorldToMinimap(pos.x, pos.z, originX, originZ, scale);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1.5, width * 0.008), 0, Math.PI * 2);
    ctx.fill();
  }

  if (!playerState.inVehicle) {
    const carMapPos = mapWorldToMinimap(vehicle.position.x, vehicle.position.z, originX, originZ, scale);
    ctx.save();
    ctx.translate(carMapPos.x, carMapPos.y);
    ctx.rotate(Math.PI - vehicle.heading);
    ctx.fillStyle = '#5fd0ff';
    ctx.fillRect(-4, -7, 8, 14);
    ctx.restore();
  }

  if (!playerState.inVehicle && playerState.moveTargetActive) {
    const targetPos = mapWorldToMinimap(playerState.moveTarget.x, playerState.moveTarget.z, originX, originZ, scale);
    const visible = Math.abs(playerState.moveTarget.x - originX) <= minimapRange && Math.abs(playerState.moveTarget.z - originZ) <= minimapRange;
    if (visible) {
      ctx.strokeStyle = '#9be18f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(targetPos.x, targetPos.y, Math.max(5, width * 0.024), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(width * 0.5, height * 0.5);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.strokeStyle = 'rgba(155,225,143,0.55)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  if (missionState.active) {
    const mission = missionDefinitions[missionState.currentMissionIndex];
    const checkpoint = mission.checkpoints[missionState.currentCheckpointIndex];
    const p = mapWorldToMinimap(checkpoint.x, checkpoint.z, originX, originZ, scale);
    const cx = width * 0.5;
    const cy = height * 0.5;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const distance = Math.hypot(dx, dy) || 1;
    const guideRadius = width * 0.42;
    const targetX = distance > guideRadius ? cx + dx / distance * guideRadius : p.x;
    const targetY = distance > guideRadius ? cy + dy / distance * guideRadius : p.y;

    ctx.strokeStyle = 'rgba(86,182,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (distance <= guideRadius) {
      ctx.strokeStyle = '#56b6ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(6, width * 0.032), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.translate(targetX, targetY);
      ctx.rotate(Math.atan2(dy, dx) + Math.PI * 0.5);
      ctx.fillStyle = '#56b6ff';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(6.5, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6.5, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  const cx = width * 0.5;
  const cy = height * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI - getActiveHeading());
  ctx.fillStyle = playerState.inVehicle ? '#ff5f5f' : '#9be18f';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(8, 10);
  ctx.lineTo(0, 5);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
}

// ------------------------------------------------------------
// World bootstrapping
// ------------------------------------------------------------
function buildWorld() {
  createSkySun();
  createGround();
  createRoadNetwork();
  populateBlocks();
  createStreetlights();
  createTrafficLights();
  updateTrafficSignalVisuals();
  createBoundaryBarriers();
  createDecorProps();
  buildTrafficSystem();
  buildPedestrianSystem();
  updateCarModel();
  updatePlayerAvatar(0);
  updateHud();
  updateMissionHud();
}

buildWorld();
resizeMinimapCanvas();
updateMobileUi();
loading.classList.remove('visible');

// ------------------------------------------------------------
// Game state / loop
// ------------------------------------------------------------
let gameStarted = false;

playButton.addEventListener('click', () => {
  gameStarted = true;
  menu.classList.remove('visible');
  hud.classList.remove('hidden');
  clock.start();
  startMission(0);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  resizeMinimapCanvas();
  updateMobileUi();
});

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta() || 0.016, 0.033);

  if (gameStarted) {
    updateTraffic(dt);
    if (playerState.inVehicle) {
      updateVehicle(dt);
    } else {
      updateOnFoot(dt);
    }
    updatePedestrians(dt);
    updateMission(dt);
    updateCamera(dt);
    drawMinimap();
    playerState.hornPulse = damp(playerState.hornPulse, input.horn ? 1 : 0, input.horn ? 10 : 5, dt);
  } else {
    const idleTarget = new THREE.Vector3(vehicle.position.x - 6, 4.4, vehicle.position.z + 8);
    camera.position.lerp(idleTarget, 0.02);
    camera.lookAt(vehicle.position.x, 1.0, vehicle.position.z);
  }

  renderer.render(scene, camera);
}

animate();
