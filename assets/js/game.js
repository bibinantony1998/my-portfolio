import * as THREE from 'three';

// --- Global Variables ---
let scene, camera, renderer;
let car, carBody, wheels = [];
let terrainMesh; // The ground
let obstacles = []; // Bushes/Rocks
let clouds = []; // Floating clouds
let velocity = 0;
const maxSpeed = 0.5;
const acceleration = 0.01;
const friction = 0.98;
const turnSensitivity = 0.03;
const WORLD_SIZE = 140;

// Physics State
let angularVelocity = 0;
let houses = [];

// Input State
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

init();
animate();

function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    renderer.render(scene, camera);
}

// Ensure random houses are generated
function init() {
    // 1. Scene Setup - Classic Nature
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 20, 100);

    // FIX: Force Scroll to Top & Disable Restoration
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Ensure scroll is possible
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';

    // 2. Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, -15); // Behind car
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    let canvas = document.querySelector('#gameOverlay');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'gameOverlay';
        document.body.prepend(canvas);
    }
    if (canvas.dataset.engine) {
        const newCanvas = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(newCanvas, canvas);
        canvas = newCanvas;
    }

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // 5. Environment
    createSimpleTerrain();
    createVegetation();
    createClouds();

    // Checkpoints (Houses) - Random Scatter & Clear Spawn
    let houseCount = 0;
    while (houseCount < 6) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 30 + Math.random() * 90; // 30 to 120 radius
        const hx = Math.sin(angle) * radius;
        const hz = Math.cos(angle) * radius;

        // Final Safety Check
        if (Math.abs(hx) > 10 || Math.abs(hz) > 10) {
            createHouse(hx, hz, Math.random() * Math.PI * 2);
            houseCount++;
        }
    }

    console.log("Game Initialized. Obstacles:", obstacles.length); // DEBUG

    // 6. Car
    createCar();

    // 7. Inputs
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', (e) => onKey(e, true));
    document.addEventListener('keyup', (e) => onKey(e, false));
}

function createHouse(x, z, rotationY) {
    const group = new THREE.Group();

    // Even Smaller House Dimensions
    // Base
    const baseGeo = new THREE.BoxGeometry(3, 2.5, 3);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 1.25;
    base.castShadow = true;
    group.add(base);

    // Roof
    const roofGeo = new THREE.ConeGeometry(2.8, 1.8, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Door
    const doorGeo = new THREE.BoxGeometry(0.8, 1.5, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a3c31 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 0.8, 1.51);
    group.add(door);

    // Position
    const y = getTerrainHeight(x, z);
    group.position.set(x, y, z);
    if (rotationY) group.rotation.y = rotationY;

    scene.add(group);
    obstacles.push({ mesh: group, radius: 2.5, type: 'house' });
}

function checkCollisions(nextX, nextZ) {
    const carRadius = 1.5;
    for (let obs of obstacles) {
        const dx = nextX - obs.mesh.position.x;
        const dz = nextZ - obs.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 10) {
            console.log("Close to obstacle:", dist); // DEBUG
        }

        if (dist < (carRadius + obs.radius)) {
            console.log("HIT!", obs); // DEBUG
            return { obstacle: obs.mesh, dist: dist, type: obs.type };
        }
    }
    return null;
}

// --- Logic ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updatePhysics() {
    // Inputs
    let moveFwd = keys.w || keys.ArrowUp;
    let moveBwd = keys.s || keys.ArrowDown;
    let turnL = keys.a || keys.ArrowLeft;
    let turnR = keys.d || keys.ArrowRight;

    // Accel
    if (moveFwd) velocity += acceleration;
    if (moveBwd) velocity -= acceleration;

    // Friction
    velocity *= friction;
    angularVelocity *= 0.9;

    // Turn
    if (Math.abs(velocity) > 0.01) {
        if (turnL) car.rotation.y += turnSensitivity * Math.sign(velocity);
        if (turnR) car.rotation.y -= turnSensitivity * Math.sign(velocity);
    }

    // Apply Spin
    car.rotation.y += angularVelocity;

    // Proposed Move
    const nextX = car.position.x + Math.sin(car.rotation.y) * velocity;
    const nextZ = car.position.z + Math.cos(car.rotation.y) * velocity;

    // Collision Check
    const col = checkCollisions(nextX, nextZ);

    if (col) {
        const dx = col.obstacle.position.x - car.position.x;
        const dz = col.obstacle.position.z - car.position.z;
        const angle = Math.atan2(dz, dx);

        if (col.type === 'bush') {
            // BUSH: Slow down logically (Drag), pass through
            // Don't stop, just drag
            velocity *= 0.95;
            car.position.x = nextX;
            car.position.z = nextZ;

        } else if (col.type === 'house') {
            // HOUSE: Stop dead (Park). Logic checkpoint.
            velocity = 0;
            // Gentle push out to prevent clipping
            const pushDist = 0.5;
            car.position.x -= Math.cos(angle) * pushDist;
            car.position.z -= Math.sin(angle) * pushDist;

        } else {
            // ROCK: Hard Bounce & Spin
            velocity = -velocity * 0.8;

            const rightX = Math.cos(car.rotation.y);
            const rightZ = -Math.sin(car.rotation.y);
            const dot = (dx * rightX + dz * rightZ);

            angularVelocity += -dot * 0.2 * (Math.abs(velocity) + 1.0);

            const pushDist = 1.2;
            car.position.x -= Math.cos(angle) * pushDist;
            car.position.z -= Math.sin(angle) * pushDist;
        }

    } else {
        // Boundary Check
        if (Math.abs(nextX) < WORLD_SIZE && Math.abs(nextZ) < WORLD_SIZE) {
            car.position.x = nextX;
            car.position.z = nextZ;
        } else {
            velocity = -velocity * 0.5;
            angularVelocity += (Math.random() - 0.5) * 0.1;
        }
    }

    // Terrain Follow
    const groundH = getTerrainHeight(car.position.x, car.position.z);
    car.position.y = THREE.MathUtils.lerp(car.position.y, groundH, 0.2);

    // Tilt
    const frontH = getTerrainHeight(
        car.position.x + Math.sin(car.rotation.y),
        car.position.z + Math.cos(car.rotation.y)
    );
    const pitch = (frontH - groundH) * 0.5;
    car.rotation.x = THREE.MathUtils.lerp(car.rotation.x, pitch, 0.1);

    // --- Drive-to-Scroll Sync (Relative/Directional) ---
    // If driving "Down" (South/Positive Z) -> Scroll Down
    // If driving "Up" (North/Negative Z) -> Scroll Up

    // Calculate Z movement component
    const moveZ = Math.cos(car.rotation.y) * velocity;

    // Check Direction logic (Top vs Bottom part approximation)
    if (Math.abs(moveZ) > 0.01) {
        const scrollSensitivity = 20.0; // Increased sensitivity
        window.scrollBy(0, moveZ * scrollSensitivity);
    }

    // Camera Follow
    const relOffset = new THREE.Vector3(0, 7, -14);
    const camOffset = relOffset.applyMatrix4(car.matrixWorld);
    camera.position.lerp(camOffset, 0.1);
    camera.lookAt(car.position.x, car.position.y + 1, car.position.z);
}

function onKey(e, pressed) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        if (e.type === 'keydown') e.preventDefault();
    }
    if (keys.hasOwnProperty(e.key) || keys.hasOwnProperty(e.code)) {
        keys[e.key] = pressed;
        keys[e.code] = pressed;
    }
}

// --- World Generation ---

function getTerrainHeight(x, z) {
    // Gentle rolling hills
    return Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2;
}

function createSimpleTerrain() {
    const geometry = new THREE.PlaneGeometry(300, 300, 64, 64);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const y = getTerrainHeight(x, z);
        positions.setY(i, y);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        color: 0x5cb85c, // Vibrant Green
        roughness: 0.8,
        metalness: 0.0
    });

    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
}

function createVegetation() {
    // Bushes (Spheres)
    const bushGeo = new THREE.SphereGeometry(1, 8, 8);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3d8b3d });

    for (let i = 0; i < 50; i++) {
        const x = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;

        // Clear Spawn Area
        if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

        const bush = new THREE.Mesh(bushGeo, bushMat);
        const y = getTerrainHeight(x, z);

        bush.position.set(x, y + 0.5, z);
        bush.scale.set(1.5 + Math.random(), 1.0, 1.5 + Math.random()); // Wider but normal height
        bush.castShadow = true;
        scene.add(bush);
        obstacles.push({ mesh: bush, radius: 1.5, type: 'bush' });
    }

    // Rocks (Dodecahedrons)
    const rockGeo = new THREE.DodecahedronGeometry(1.2);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888 });

    for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;

        // Clear Spawn Area
        if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;

        const rock = new THREE.Mesh(rockGeo, rockMat);
        const y = getTerrainHeight(x, z);

        rock.position.set(x, y + 0.6, z);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        scene.add(rock);
        obstacles.push({ mesh: rock, radius: 1.8, type: 'rock' });
    }
}

function createClouds() {
    const geo = new THREE.BoxGeometry(4, 1, 3);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });

    for (let i = 0; i < 10; i++) {
        const cloud = new THREE.Mesh(geo, mat);
        cloud.position.set(
            (Math.random() - 0.5) * 200,
            20 + Math.random() * 10,
            (Math.random() - 0.5) * 200
        );
        scene.add(cloud);
        clouds.push(cloud);
    }
}

function createCar() {
    car = new THREE.Group();

    // Red Boxy Body
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.8, 3.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd9534f }); // Classic Bootstrap Danger Red
    carBody = new THREE.Mesh(bodyGeo, bodyMat);
    carBody.position.y = 0.8;
    carBody.castShadow = true;
    car.add(carBody);

    // Top
    const topGeo = new THREE.BoxGeometry(1.4, 0.6, 2.0);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.set(0, 1.5, -0.2);
    top.castShadow = true;
    car.add(top);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const positions = [
        { x: 1, z: 1.2 }, { x: -1, z: 1.2 },
        { x: 1, z: -1.2 }, { x: -1, z: -1.2 }
    ];

    positions.forEach(p => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(p.x, 0.4, p.z);
        w.rotation.z = Math.PI / 2;
        w.castShadow = true;
        car.add(w);
    });

    scene.add(car);
}
