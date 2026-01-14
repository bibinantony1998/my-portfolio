import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// --- Configuration ---
const CONFIG = {
    bloom: {
        strength: 1.5,
        radius: 0.4,
        threshold: 0
    },
    physics: {
        maxSpeed: 1.2,
        acceleration: 0.03,
        friction: 0.98,
        turnSpeed: 0.05,
        driftFactor: 0.96
    },
    camera: {
        height: 8,
        distance: 12,
        lag: 0.1
    }
};

// --- Global State ---
let scene, camera, renderer, composer;
let car, carBody;
let terrainParams = { speed: 0, offset: 0 };
let gameState = {
    level: 1,
    locked: true
};

// Input State
const keys = { w: false, a: false, s: false, d: false, Shift: false };

// Physics State
let velocity = 0;
let driftAngle = 0;

init();
animate();

function init() {
    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510); // Deep Space Blue/Black
    scene.fog = new THREE.FogExp2(0x050510, 0.015);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    // 3. Renderer
    const canvas = document.querySelector('#gameOverlay');
    // Context Fix
    if (canvas.dataset.engine) {
        const newCanvas = canvas.cloneNode(true);
        canvas.parentNode.replaceChild(newCanvas, canvas);
        canvas = newCanvas;
    }

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" }); // Antialias off for Bloom perf
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;

    // 4. Post-Processing (BLOOM)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = CONFIG.bloom.threshold;
    bloomPass.strength = CONFIG.bloom.strength;
    bloomPass.radius = CONFIG.bloom.radius;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 5. Lighting (Cinematic)
    const ambientInfo = new THREE.AmbientLight(0x4040a0, 1.5); // Blue tint
    scene.add(ambientInfo);

    const sun = new THREE.DirectionalLight(0xff00ff, 2); // Pink Sun
    sun.position.set(-50, 20, -50);
    sun.castShadow = true;
    scene.add(sun);

    const spot = new THREE.SpotLight(0x00f2ff, 10); // Cyan Highlight
    spot.position.set(20, 50, 20);
    spot.angle = 0.5;
    spot.penumbra = 0.5;
    scene.add(spot);

    // 6. World & Player
    createLevel1();
    createPlayer();

    // 7. Events
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', (e) => onKey(e, true));
    document.addEventListener('keyup', (e) => onKey(e, false));

    // Initial Lock UI (simulated)
    document.body.classList.add('game-locked');
}

function onKey(e, pressed) {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = pressed;
    if (e.key === 'Shift') keys.Shift = pressed;
    if (e.code === 'ArrowUp') keys.w = pressed;
    if (e.code === 'ArrowDown') keys.s = pressed;
    if (e.code === 'ArrowLeft') keys.a = pressed;
    if (e.code === 'ArrowRight') keys.d = pressed;
}

function createPlayer() {
    car = new THREE.Group();

    // Chassis (Cyber-Truck Style)
    const geo = new THREE.BufferGeometry();
    // Simple low-poly cyberpunk car shape
    // Placeholder Box for now, but with neon edges
    const box = new THREE.BoxGeometry(2, 0.8, 4.5);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.2,
        metalness: 0.9
    });
    const mesh = new THREE.Mesh(box, mat);
    mesh.position.y = 0.7;
    car.add(mesh);

    // Neon Strips
    const stripGeo = new THREE.BoxGeometry(2.05, 0.1, 4.6);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff }); // Cyan Glow
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = 0.4;
    car.add(strip);

    // Engine Glow (Rear)
    const engineGeo = new THREE.BoxGeometry(1.8, 0.4, 0.1);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.set(0, 0.8, 2.25);
    car.add(engine);

    scene.add(car);
}

function createLevel1() {
    // Infinite Highway (Synthwave Grid)
    // Instead of moving the car forward infinitely, we move the WORLD backwards?
    // Or just move car and generate new tiles.
    // Let's do Infinite Scrolling Grid Shader on a Plane.

    const gridGeo = new THREE.PlaneGeometry(500, 500, 100, 100);
    gridGeo.rotateX(-Math.PI / 2);

    // Custom Material for animation
    const gridMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x220033,
        roughness: 0.1,
        metalness: 0.8,
        wireframe: true
    });

    const floor = new THREE.Mesh(gridGeo, gridMat);
    floor.position.y = -0.1;
    scene.add(floor);

    // Mountains / Cityscape (Procedural later)
    // For now, just decorative neon pillars
    for (let i = 0; i < 40; i++) {
        const h = Math.random() * 20 + 5;
        const geo = new THREE.BoxGeometry(2, h, 2);
        const mat = new THREE.MeshLambertMaterial({ color: Math.random() > 0.5 ? 0xff00ff : 0x00f2ff });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.x = (Math.random() - 0.5) * 200;
        if (Math.abs(mesh.position.x) < 20) mesh.position.x += 30; // Clear road
        mesh.position.z = (Math.random() - 0.5) * 500;
        mesh.position.y = h / 2;
        scene.add(mesh);
    }
}

function updatePhysics() {
    // Acceleration
    if (keys.w) velocity += CONFIG.physics.acceleration;
    if (keys.s) velocity -= CONFIG.physics.acceleration;

    // Friction
    velocity *= CONFIG.physics.friction;

    // Cap Speed
    if (Math.abs(velocity) > CONFIG.physics.maxSpeed) {
        velocity = Math.sign(velocity) * CONFIG.physics.maxSpeed;
    }

    // Turning & Drift
    if (Math.abs(velocity) > 0.05) {
        const turnDir = keys.a ? 1 : (keys.d ? -1 : 0);

        // Drift mechanics:
        // If Shift is held, we slide more (less rotation grip, more momentum)
        // Simple implementation:
        car.rotation.y += turnDir * CONFIG.physics.turnSpeed * Math.sign(velocity);

        // Cosmetic Drift (Car body rotation local)
        // car.children[0].rotation.z ... (todo)
    }

    // Move Car
    car.position.x += Math.sin(car.rotation.y) * velocity;
    car.position.z += Math.cos(car.rotation.y) * velocity;

    // Infinite World Loop (Illusion)
    // If car goes too far, reset? No, let's just let it drive for Level 1.
}

function updateCamera() {
    if (!car) return;

    // Smooth Follow
    const targetPos = new THREE.Vector3(
        car.position.x - Math.sin(car.rotation.y) * CONFIG.camera.distance,
        car.position.y + CONFIG.camera.height,
        car.position.z - Math.cos(car.rotation.y) * CONFIG.camera.distance
    );

    camera.position.lerp(targetPos, CONFIG.camera.lag);
    camera.lookAt(car.position.x, car.position.y + 2, car.position.z);
}

function onResize() {
    // Quality of life resize
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    updatePhysics();
    updateCamera();

    // renderer.render(scene, camera);
    composer.render(); // Use Composer for Bloom
}
