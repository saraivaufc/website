import * as THREE from 'three';
import { pass } from 'three/tsl';

import Stats from 'three/addons/libs/stats.module.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const radius = 6371;
const tilt = 0.41;
const rotationSpeed = 0.1;
//const moonOrbitRadius = radius * 1.5;
//const moonOrbitSpeed = 1;

const cloudsScale = 1.01;
const moonScale = 0.23;

const MARGIN = 0;

let camera, mixer, controls, scene, renderer, stats;
let geometry, meshPlanet, meshClouds, meshMoon;
let dirLight;

let postProcessing;

const textureLoader = new THREE.TextureLoader();

let d, dPlanet, dMoon, dSatellite;
const dMoonVec = new THREE.Vector3();
const dSatelliteVec = new THREE.Vector3();

const clock = new THREE.Clock();

let root = document.getElementById("about");
let SCREEN_HEIGHT = window.innerHeight - MARGIN * 4;
let SCREEN_WIDTH = window.innerWidth;


const landsatAltitude = 917;
const sentinel2AltitudeKM = 786;

// Defina a velocidade orbital para cada tipo de satélite
const landsatPeriod = 99 * 60; // 99 minutos em segundos
const landsatOrbitInclinationDegrees = 98.2;
const landsatScale = radius * 0.1;


const sentinelPeriod = 92 * 60; // 92 minutos em segundos
const sentinelOrbitInclinationDegrees = 98.62;
const sentinel2Scale = radius * 0.01;

// Calcule o offset para cada satélite com base no tempo de início desejado
const currentTime = clock.getElapsedTime(); // Tempo atual em segundos


// Define the satellites
let satellites = [
    {
        // https://sketchfab.com/3d-models/eoes-satellite-landsat-8-clean-topo-4cf892ee33b94978a3b70309bbc2a76f
        url: "/static/landsat_8.glb",
        mesh: null,
        orbitRadius: radius * (1 + landsatAltitude/radius),
        period: 99 * 60, // 99 minutes in seconds
        scale: landsatScale,
        inclination: landsatOrbitInclinationDegrees * (Math.PI / 180),
        initialOffset: 0
    },
    {
        url: "/static/landsat_8.glb",
        mesh: null,
        orbitRadius: radius * (1 + landsatAltitude/radius),
        period: 99 * 60, // 99 minutes in seconds
        scale: landsatScale,
        inclination: landsatOrbitInclinationDegrees * (Math.PI / 180),
        initialOffset:  Math.PI
    },
    {
        // https://sketchfab.com/3d-models/satellite-f5b831cb737041b088ce83fcf8014e20
        url: "/static/aqua_satellite.glb",
        mesh: null,
        orbitRadius: radius * (1 + sentinel2AltitudeKM/radius),
        period: 92 * 60, // Approximate period in seconds
        scale: sentinel2Scale,
        inclination: sentinelOrbitInclinationDegrees * (Math.PI / 180),
        initialOffset:  Math.PI * 0.5
    },
    {
        url: "/static/aqua_satellite.glb",
        mesh: null,
        orbitRadius: radius * (1 + sentinel2AltitudeKM/radius),
        period: 99 * 60, // Approximate period in seconds
        scale:  sentinel2Scale,
        inclination: sentinelOrbitInclinationDegrees * (radius / 180),
        initialOffset:  Math.PI * 1.5
    }
];



init();

function init() {
    
    const loader = new GLTFLoader();

    camera = new THREE.PerspectiveCamera(30, SCREEN_WIDTH / SCREEN_HEIGHT, 50, 1e7);
    camera.position.z = radius * 5;
    camera.position.x = radius * -0.3;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.00000025);

    dirLight = new THREE.DirectionalLight(0xffffff, 3);
    dirLight.position.set(-1, 0, 1).normalize();
    scene.add(dirLight);

    geometry = new THREE.SphereGeometry(radius, 100, 50);


    // https://sketchfab.com/3d-models/earth-breathing-37c49133f0704db7a51c54fddf05f053
    loader.load('/static/earth_breathing.glb', function (gltf) {
        meshPlanet = gltf.scene;

        mixer = new THREE.AnimationMixer(meshPlanet);
        console.log(gltf.animations)
        gltf.animations.forEach((clip) => {
            let action = mixer.clipAction(clip);
            action.loop = THREE.LoopPingPong;
            action.setDuration(5);
            action.play();
        });

        meshPlanet.position.set(1, 1, 10);
        meshPlanet.rotation.y = 0;
        meshPlanet.rotation.z = tilt;
        meshPlanet.scale.set(radius * 0.8, radius * 0.8, radius * 0.8); 
        scene.add(meshPlanet);

    }, undefined, function (error) {
        console.error(error);
    });

    // clouds
    const materialClouds = new THREE.MeshLambertMaterial({
        map: textureLoader.load('/static/textures/planets/earth_clouds_1024.png'),
        transparent: true
    });
    materialClouds.map.colorSpace = THREE.SRGBColorSpace;

    meshClouds = new THREE.Mesh(geometry, materialClouds);
    meshClouds.scale.set(cloudsScale, cloudsScale, cloudsScale);
    meshClouds.rotation.z = tilt;
    scene.add(meshClouds);

    // moon
    /*
    const materialMoon = new THREE.MeshPhongMaterial({
        map: textureLoader.load('/static/textures/planets/moon_1024.jpg')
    });
    materialMoon.map.colorSpace = THREE.SRGBColorSpace;

    meshMoon = new THREE.Mesh(geometry, materialMoon);
    meshMoon.position.set(moonOrbitRadius, 0, 0);
    meshMoon.scale.set(moonScale, moonScale, moonScale);
    scene.add(meshMoon);
    */
    // Load satellite models

    satellites.forEach(function(satellite){
        loader.load(satellite.url, function (gltf) {
            satellite.mesh = gltf.scene;
            satellite.mesh.scale.set(satellite.scale, satellite.scale, satellite.scale); // Scale the satellite model
            scene.add(satellite.mesh);
        }, undefined, function (error) {
            console.error(error);
        });

    })

    // stars
    const r = radius, starsGeometry = [new THREE.BufferGeometry(), new THREE.BufferGeometry()];

    const vertices1 = [];
    const vertices2 = [];

    const vertex = new THREE.Vector3();

    for (let i = 0; i < 250; i++) {
        vertex.x = Math.random() * 2 - 1;
        vertex.y = Math.random() * 2 - 1;
        vertex.z = Math.random() * 2 - 1;
        vertex.multiplyScalar(r);

        vertices1.push(vertex.x, vertex.y, vertex.z);
    }

    for (let i = 0; i < 1500; i++) {
        vertex.x = Math.random() * 2 - 1;
        vertex.y = Math.random() * 2 - 1;
        vertex.z = Math.random() * 2 - 1;
        vertex.multiplyScalar(r);

        vertices2.push(vertex.x, vertex.y, vertex.z);
    }

    starsGeometry[0].setAttribute('position', new THREE.Float32BufferAttribute(vertices1, 3));
    starsGeometry[1].setAttribute('position', new THREE.Float32BufferAttribute(vertices2, 3));

    const starsMaterials = [
        new THREE.PointsMaterial({ color: 0x9c9c9c }),
        new THREE.PointsMaterial({ color: 0x838383 }),
        new THREE.PointsMaterial({ color: 0x5a5a5a })
    ];

    for (let i = 10; i < 30; i++) {
        const stars = new THREE.Points(starsGeometry[i % 2], starsMaterials[i % 3]);

        stars.rotation.x = Math.random() * 6;
        stars.rotation.y = Math.random() * 6;
        stars.rotation.z = Math.random() * 6;
        stars.scale.setScalar(i * 10);

        stars.matrixAutoUpdate = false;
        stars.updateMatrix();

        scene.add(stars);
    }

    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.setAnimationLoop(animate);
    document.body.appendChild(renderer.domElement);

    // controls
    controls = new FlyControls(camera, renderer.domElement);

    controls.movementSpeed = 1000;
    controls.domElement = renderer.domElement;
    controls.rollSpeed = Math.PI / 24;
    controls.autoForward = false;
    controls.dragToLook = true;

    stats = new Stats();
    //document.body.appendChild(stats.dom); -- Apresenta os FPS

    window.addEventListener('resize', onWindowResize, false);
    
    // Post-processing
    postProcessing = new THREE.PostProcessing(renderer);
    const scenePass = pass(scene, camera);
    const scenePassColor = scenePass.getTextureNode();

    postProcessing.outputNode = scenePassColor.film();
}

function onWindowResize() {
    SCREEN_HEIGHT = window.innerHeight - MARGIN * 4;
    SCREEN_WIDTH = window.innerWidth;
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    camera.updateProjectionMatrix();
}

function render() {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    
    // rotate the planet and clouds
    if(meshPlanet){
        meshPlanet.rotation.y += rotationSpeed * delta;
        meshClouds.rotation.y += 1.5 * rotationSpeed * delta;
    }

    if ( mixer ){
        mixer.update( delta );
    }

    // update moon position for orbiting the planet
    if (meshMoon){
        /*
        const moonX = moonOrbitRadius * Math.cos(time * moonOrbitSpeed);
        const moonZ = moonOrbitRadius * Math.sin(time * moonOrbitSpeed);
        meshMoon.position.set(moonX, 0, moonZ);
        meshMoon.rotation.y += rotationSpeed * delta;
        */
    }

    // update satellite positions for orbiting the planet
    satellites.forEach(satellite => {
        const { mesh, orbitRadius, period, inclination, initialOffset } = satellite;
        const orbitSpeed = 2 * Math.PI / period;

        // Calculate satellite position with initial offset
        const adjustedTime = time + initialOffset;
        const orbitZ = orbitRadius * Math.sin(adjustedTime);
        const orbitY = orbitRadius * Math.cos(adjustedTime);
        const orbitX = orbitRadius * Math.sin(adjustedTime) * Math.sin(inclination);

        mesh.position.set(-orbitX, orbitY, orbitZ);
        mesh.rotation.y += orbitSpeed;
    });

    // slow down as we approach the surface
    dPlanet = camera.position.length();

    //dMoonVec.subVectors(camera.position, meshMoon.position);
    dMoon = dMoonVec.length();

    let dSatelliteMin = Infinity;
    satellites.forEach(satellite => {
        dSatelliteVec.subVectors(camera.position, satellite.mesh.position);
        const distance = dSatelliteVec.length();
        if (distance < dSatelliteMin) {
            dSatelliteMin = distance;
        }
    });

    if (dMoon < dPlanet && dMoon < dSatelliteMin) {
        d = (dMoon - radius * moonScale * 1.01);
    } else if (dSatelliteMin < dPlanet && dSatelliteMin < dMoon) {
        d = (dSatelliteMin - radius * landsatScale * 1.01);
    } else {
        d = (dPlanet - radius * 1.01);
    }

    controls.movementSpeed = 0.33 * d;

    postProcessing.render();
}

function animate() {
    stats.update();
    render();
}
