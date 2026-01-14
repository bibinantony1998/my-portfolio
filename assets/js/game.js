import * as THREE from 'three';

// --- Global Variables ---
let scene, camera, renderer;
let car, carBody, wheels = [];
let ground;
let moveForward = false, moveBackward = false, turnLeft = false, turnRight = false;
let velocity = 0, rotationSpeed = 0;
const maxSpeed = 0.8; // Increased speed for scale
const acceleration = 0.02;
const friction = 0.98;
const turnSensitivity = 0.03;

// Zones for interactions (positions to drive to)
// Scale: 1 unit ~ 1 meter. Map size ~ 200x200.
const zones = [
    { name: 'About', x: 0, z: -40, color: 0x00f2ff, sectionId: 'about' },
    { name: 'Projects', x: -40, z: 0, color: 0xff0055, sectionId: 'work' },
    { name: 'Blog', x: 40, z: 0, color: 0xffff00, sectionId: 'blog' },
    { name: 'Contact', x: 0, z: 40, color: 0x00ff00, sectionId: 'contact' }
];

init();
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a); // Dark background
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.015);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, -20);
    camera.lookAt(0, 0, 0);

    // 3. Renderer
    const canvas = document.querySelector('#gameOverlay');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 50, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Neon City Lights
    const cityLight1 = new THREE.PointLight(0x00f2ff, 0.5, 100);
    cityLight1.position.set(20, 10, 20);
    scene.add(cityLight1);
    const cityLight2 = new THREE.PointLight(0xff0055, 0.5, 100);
    cityLight2.position.set(-20, 10, -20);
    scene.add(cityLight2);

    // 5. Ground (Infinite Grid look)
    const planeGeometry = new THREE.PlaneGeometry(500, 500);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.8,
        metalness: 0.2
    });
    ground = new THREE.Mesh(planeGeometry, planeMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(500, 100, 0x333333, 0x222222);
    scene.add(gridHelper);

    // 6. Build Car (Low Poly Cybertruck-ish)
    createCar();

    // 7. Build Zones (Text Labels / Pillars)
    createZones();

    // 8. Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function createCar() {
    car = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 1, 4);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x00f2ff,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x00f2ff,
        emissiveIntensity: 0.5
    });
    carBody = new THREE.Mesh(bodyGeo, bodyMat);
    carBody.position.y = 1;
    carBody.castShadow = true;
    car.add(carBody);

    // Neon Strips (Extra visibility)
    const stripGeo = new THREE.BoxGeometry(2.1, 0.1, 4.1);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xff0055 }); // Pink outline
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = 0.6;
    car.add(strip);

    // Navigation Arrow
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0);
    arrowShape.lineTo(-1, -2);
    arrowShape.lineTo(0, -1.5);
    arrowShape.lineTo(1, -2);
    arrowShape.lineTo(0, 0);

    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(0, 3, 0); // Float above car
    arrow.name = 'navArrow';
    car.add(arrow);

    // ... rest of car parts ...


    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.8, 0.6, 2);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }); // Dark Glass
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.8, 0);
    car.add(cabin);

    // Headlights
    const lightTarget = new THREE.Object3D();
    lightTarget.position.set(0, 1, 10);
    car.add(lightTarget);

    const headLightL = new THREE.SpotLight(0xffffff, 20); // High intensity for GLTF
    headLightL.angle = Math.PI / 6;
    headLightL.penumbra = 0.2;
    headLightL.position.set(0.6, 1, 1.8);
    headLightL.target = lightTarget;
    headLightL.castShadow = true;
    car.add(headLightL);

    const headLightR = new THREE.SpotLight(0xffffff, 20);
    headLightR.angle = Math.PI / 6;
    headLightR.penumbra = 0.2;
    headLightR.position.set(-0.6, 1, 1.8);
    headLightR.target = lightTarget;
    car.add(headLightR);

    // Tail lights
    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const tailLightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
    const tailLightL = new THREE.Mesh(tailLightGeo, tailLightMat);
    tailLightL.position.set(0.6, 1, -2.05);
    car.add(tailLightL);
    const tailLightR = new THREE.Mesh(tailLightGeo, tailLightMat);
    tailLightR.position.set(-0.6, 1, -2.05);
    car.add(tailLightR);


    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // Position wheels
    const wheelPositions = [
        { x: 1.1, z: 1.2 }, { x: -1.1, z: 1.2 },
        { x: 1.1, z: -1.2 }, { x: -1.1, z: -1.2 }
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, 0.5, pos.z);
        wheel.castShadow = true;
        car.add(wheel);
        wheels.push(wheel); // Track for rotation animation if needed
    });

    scene.add(car);
}

function createZones() {
    zones.forEach(zone => {
        // Marker on ground
        const geometry = new THREE.RingGeometry(3, 3.5, 32);
        const material = new THREE.MeshBasicMaterial({ color: zone.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.set(zone.x, 0.1, zone.z);
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);

        // Simple Pillar/Beacon
        const pillarGeo = new THREE.CylinderGeometry(0.2, 0.2, 20, 8);
        const pillarMat = new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.3 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(zone.x, 10, zone.z);
        scene.add(pillar);

        // Floating Text (HTML Overlay handled in Animation Loop)
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    if (document.getElementById('gameOverlay').style.display === 'none') return;
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': turnLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': turnRight = true; break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': turnLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': turnRight = false; break;
    }
}

function updatePhysics() {
    // Acceleration
    if (moveForward) velocity += acceleration;
    if (moveBackward) velocity -= acceleration;

    // Friction
    if (!moveForward && !moveBackward) {
        velocity *= friction;
    }

    // Limit Speed
    if (velocity > maxSpeed) velocity = maxSpeed;
    if (velocity < -maxSpeed / 2) velocity = -maxSpeed / 2; // Slower reverse

    // Steering (only when moving)
    if (Math.abs(velocity) > 0.01) {
        if (turnLeft) car.rotation.y += turnSensitivity * Math.sign(velocity);
        if (turnRight) car.rotation.y -= turnSensitivity * Math.sign(velocity);
    }

    // Apply movement
    car.position.x += Math.sin(car.rotation.y) * velocity;
    car.position.z += Math.cos(car.rotation.y) * velocity;

    // Camera Follow
    const relativeCameraOffset = new THREE.Vector3(0, 10, -15);
    const cameraOffset = relativeCameraOffset.applyMatrix4(car.matrixWorld);
    camera.position.lerp(cameraOffset, 0.1);
    camera.lookAt(car.position);

    // Update Arrow Direction
    const arrow = car.getObjectByName('navArrow');
    if (arrow) {
        // Find nearest zone
        let nearestDist = Infinity;
        let targetZone = zones[0];

        zones.forEach(zone => {
            const dist = Math.sqrt(Math.pow(zone.x - car.position.x, 2) + Math.pow(zone.z - car.position.z, 2));
            if (dist < nearestDist) {
                nearestDist = dist;
                targetZone = zone;
            }
        });

        // Point arrow to it (Arrow is child of car, so we need to compensate for car rotation)
        // Point arrow to it (Arrow is child of car, so we need to compensate for car rotation)
        const angleToTarget = Math.atan2(targetZone.x - car.position.x, targetZone.z - car.position.z);

        // Rotate around Y (Global Up).
        // Since it's child of Car (which rotates Y), we counter-rotate.
        arrow.rotation.set(-Math.PI / 2, 0, angleToTarget - car.rotation.y + Math.PI);
    }
}

function checkZones() {
    const carPos = car.position;
    let inAnyZone = false;

    zones.forEach(zone => {
        const dist = Math.sqrt(Math.pow(zone.x - carPos.x, 2) + Math.pow(zone.z - carPos.z, 2));
        if (dist < 5) {
            inAnyZone = true;
            triggerSection(zone.sectionId);
        }
    });
}

let lastTrigger = 0;
function triggerSection(sectionId) {
    const now = Date.now();
    if (now - lastTrigger > 2000) { // Debounce 2s
        lastTrigger = now;
        console.log("Triggering section:", sectionId);
        // Dispatch event or direct scroll
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });

            // Optional: Hide game or minimize it if user wants to read
            // document.getElementById('game-container').classList.add('minimized');
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    updatePhysics();
    checkZones();
    renderer.render(scene, camera);
}
