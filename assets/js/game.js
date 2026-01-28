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
let activeSection = null; // Track active section for proximity nav

// Fixed Locations for Navigation
const SECTIONS = [
    { name: 'About', target: '#about', x: 40, z: 40, rotation: Math.PI / 4 },
    { name: 'Apps', target: '#featured-apps', x: -40, z: 40, rotation: -Math.PI / 4 },
    { name: 'Blog', target: '#blog', x: 40, z: -40, rotation: 3 * Math.PI / 4 },
    { name: 'Contact', target: '#contact', x: -40, z: -40, rotation: -3 * Math.PI / 4 },
    { name: 'Family', target: 'family-command-center.html', x: 0, z: -70, rotation: Math.PI },
    { name: 'NPM', target: '#npm-packages', x: 60, z: 0, rotation: -Math.PI / 2 },
    { name: 'GitHub', target: '#github-experiments', x: -60, z: 0, rotation: Math.PI / 2 }
];

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

    // Checkpoints (Houses) - Fixed Locations for Navigation
    // SECTIONS defined globally

    // 2. Create Houses
    SECTIONS.forEach(section => {
        createHouse(section.x, section.z, section.rotation, section.target, section.name);
    });

    // 6. Car
    createCar();

    // 7. Inputs
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', (e) => onKey(e, true));
    document.addEventListener('keyup', (e) => onKey(e, false));
}

function createHouse(x, z, rotationY, targetUrl, name) {
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

    // Label
    if (name) {
        const sprite = createTextSprite(name);
        sprite.position.set(0, 5.5, 0); // Position above the roof
        group.add(sprite);
    }

    // Position
    const y = getTerrainHeight(x, z);
    group.position.set(x, y, z);
    if (rotationY) group.rotation.y = rotationY;

    scene.add(group);
    // Add target url to obstacle object for navigation
    obstacles.push({ mesh: group, radius: 2.5, type: 'house', target: targetUrl });
}

function createTextSprite(message) {
    const fontface = 'Arial';
    const fontsize = 24;
    const borderThickness = 4;
    const borderColor = { r: 50, g: 50, b: 50, a: 1.0 };
    const backgroundColor = { r: 255, g: 255, b: 255, a: 0.8 };

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // 1. Measure text to size canvas
    context.font = "Bold " + fontsize + "px " + fontface;
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    // Canvas sizing (power of 2 is best for textures, but 3JS handles NPOT too)
    // We'll make it large enough to hold the text with padding
    canvas.width = textWidth + 20;
    canvas.height = fontsize + 14;

    // 2. Draw Background
    context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," +
        backgroundColor.b + "," + backgroundColor.a + ")";
    context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," +
        borderColor.b + "," + borderColor.a + ")";
    context.lineWidth = borderThickness;

    // Rounded rect function
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    roundRect(context, borderThickness / 2, borderThickness / 2,
        canvas.width - borderThickness, canvas.height - borderThickness, 6);

    // 3. Draw Text
    context.fillStyle = "rgba(0, 0, 0, 1.0)";
    context.font = "Bold " + fontsize + "px " + fontface;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);

    // 4. Create Texture & Sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);

    // Scale sprite to be visible in world units
    // Text should be roughly 2-3 world units wide depending on length
    // Maintain aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    const scaleY = 1.5;
    sprite.scale.set(scaleY * aspectRatio, scaleY, 1.0);

    return sprite;
}

function checkCollisions(nextX, nextZ) {
    const carRadius = 1.5;
    for (let obs of obstacles) {
        const dx = nextX - obs.mesh.position.x;
        const dz = nextZ - obs.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);


        if (dist < (carRadius + obs.radius)) {
            return { obstacle: obs.mesh, dist: dist, type: obs.type, target: obs.target };
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

    // --- PROXIMITY NAVIGATION LOGIC ---
    // Check if we are near any section
    let nearestSection = null;
    const activationRadius = 5; // Radius to activate section scroll

    for (let section of SECTIONS) {
        const dx = nextX - section.x;
        const dz = nextZ - section.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < activationRadius) {
            nearestSection = section;
            break;
        }
    }

    if (nearestSection !== activeSection) {
        activeSection = nearestSection;

        if (activeSection) {
            // Entered Section Radius -> Navigate
            if (activeSection.target.startsWith('#')) {
                window.location.href = activeSection.target;
            } else {
                window.location.href = activeSection.target;
            }
        } else {
            // LEFT all section radii -> Return to Top (Home)
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

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
            // HOUSE: Stop dead (Park).
            // Navigation handled by proximity check above.
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

            angularVelocity += -dot * 0.05 * (Math.abs(velocity) + 1.0);

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
    // Helper to check safety
    function isSafe(x, z) {
        // Safe from Center Spawn
        if (Math.abs(x) < 15 && Math.abs(z) < 15) return false;

        // Safe from ALL Houses (Sections)
        const safeRadius = 15; // Keep rocks/bushes away from houses
        for (let s of SECTIONS) {
            const dx = x - s.x;
            const dz = z - s.z;
            if ((dx * dx + dz * dz) < (safeRadius * safeRadius)) return false;
        }
        return true;
    }

    // Bushes (Spheres)
    const bushGeo = new THREE.SphereGeometry(1, 8, 8);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x3d8b3d });

    for (let i = 0; i < 50; i++) {
        const x = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;

        // Safety Check
        if (!isSafe(x, z)) continue;

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

        // Safety Check
        if (!isSafe(x, z)) continue;

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
