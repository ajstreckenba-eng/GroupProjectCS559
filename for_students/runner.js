/*jshint esversion: 6 */
// @ts-check

import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import { Random } from "./random.js";
import { GrSkyscraper, sampleSkyscraper } from "./building.js";

// Player character for the runner game
export class Player extends GrObject {
  constructor() {
    const group = new T.Group();

    // Create a textured character with procedural textures - SMALLER scale
    const scale = 0.5; // Make character half the size

    // Create procedural clothing texture
    const createClothTexture = (color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 64, 64);
      // Add fabric texture
      for (let i = 0; i < 200; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
      }
      return new T.CanvasTexture(canvas);
    };

    // Body with blue hoodie texture
    const bodyGeometry = new T.BoxGeometry(0.6 * scale, 1.5 * scale, 0.4 * scale);
    const bodyTexture = createClothTexture('#1e90ff');
    const bodyMaterial = new T.MeshStandardMaterial({
      map: bodyTexture,
      roughness: 0.8,
      metalness: 0.1
    });
    const body = new T.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75 * scale;
    group.add(body);

    // Head with skin tone and features
    const headGeometry = new T.SphereGeometry(0.3 * scale);
    const headMaterial = new T.MeshStandardMaterial({
      color: 0xffcc99,
      roughness: 0.7
    });
    const head = new T.Mesh(headGeometry, headMaterial);
    head.position.y = 1.8 * scale;
    group.add(head);

    // Add a red cap/beanie
    const capGeometry = new T.CylinderGeometry(0.35 * scale, 0.3 * scale, 0.25 * scale, 16);
    const capTexture = createClothTexture('#ff0000');
    const capMaterial = new T.MeshStandardMaterial({
      map: capTexture,
      roughness: 0.9
    });
    const cap = new T.Mesh(capGeometry, capMaterial);
    cap.position.y = 2.1 * scale;
    group.add(cap);

    // Add arms with hoodie
    const armGeometry = new T.BoxGeometry(0.2 * scale, 0.8 * scale, 0.2 * scale);
    const armMaterial = new T.MeshStandardMaterial({
      map: bodyTexture,
      roughness: 0.8
    });

    const leftArm = new T.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.45 * scale, 0.6 * scale, 0);
    group.add(leftArm);

    const rightArm = new T.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.45 * scale, 0.6 * scale, 0);
    group.add(rightArm);

    // Add legs with jeans texture
    const legGeometry = new T.BoxGeometry(0.25 * scale, 0.7 * scale, 0.25 * scale);
    const jeansTexture = createClothTexture('#1a4d7a');
    const legMaterial = new T.MeshStandardMaterial({
      map: jeansTexture,
      roughness: 0.9
    });

    const leftLeg = new T.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15 * scale, -0.35 * scale, 0);
    group.add(leftLeg);

    const rightLeg = new T.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15 * scale, -0.35 * scale, 0);
    group.add(rightLeg);

    // Add white sneakers
    const shoeGeometry = new T.BoxGeometry(0.3 * scale, 0.15 * scale, 0.4 * scale);
    const shoeCanvas = document.createElement('canvas');
    shoeCanvas.width = 32;
    shoeCanvas.height = 32;
    const shoeCtx = shoeCanvas.getContext('2d');
    shoeCtx.fillStyle = '#ffffff';
    shoeCtx.fillRect(0, 0, 32, 32);
    // Add Nike-like swoosh
    shoeCtx.strokeStyle = '#000000';
    shoeCtx.lineWidth = 2;
    shoeCtx.beginPath();
    shoeCtx.moveTo(5, 20);
    shoeCtx.quadraticCurveTo(16, 15, 27, 12);
    shoeCtx.stroke();
    const shoeTexture = new T.CanvasTexture(shoeCanvas);
    const shoeMaterial = new T.MeshStandardMaterial({
      map: shoeTexture,
      roughness: 0.6
    });

    const leftShoe = new T.Mesh(shoeGeometry, shoeMaterial);
    leftShoe.position.set(-0.15 * scale, -0.75 * scale, 0.05 * scale);
    group.add(leftShoe);

    const rightShoe = new T.Mesh(shoeGeometry, shoeMaterial);
    rightShoe.position.set(0.15 * scale, -0.75 * scale, 0.05 * scale);
    group.add(rightShoe);

    super("Player", group);

    this.lane = 1; // 0 = left, 1 = center, 2 = right
    this.isJumping = false;
    this.isSliding = false;
    this.jumpVelocity = 0;
    this.baseY = 0;
    this.slideTimer = 0;
    this.laneChangeProgress = 0;
    this.targetLane = 1;
    this.animationTime = 0; // For running animation

    // Store references to body parts for animation
    this.leftArm = leftArm;
    this.rightArm = rightArm;
    this.leftLeg = leftLeg;
    this.rightLeg = rightLeg;
    this.body = body;

    this.lanePositions = [-1, 0, 1]; // X offsets for lanes
  }

  moveLeft() {
    if (this.lane < 2 && this.laneChangeProgress === 0) {
      this.lane++;
      this.targetLane = this.lane;
      this.laneChangeProgress = 1;
    }
  }

  moveRight() {
    if (this.lane > 0 && this.laneChangeProgress === 0) {
      this.lane--;
      this.targetLane = this.lane;
      this.laneChangeProgress = 1;
    }
  }

  jump() {
    if (!this.isJumping && !this.isSliding) {
      this.isJumping = true;
      this.jumpVelocity = 0.25; // Higher initial velocity for bigger jump
    }
  }

  slide() {
    if (!this.isJumping && !this.isSliding) {
      this.isSliding = true;
      this.slideTimer = 30; // frames
      // Scale down the character
      this.objects[0].scale.y = 0.5;
      this.objects[0].position.y = this.baseY - 0.4;
    }
  }

  update(delta) {
    // Handle lane changing animation
    if (this.laneChangeProgress > 0) {
      this.laneChangeProgress -= 0.1;
      if (this.laneChangeProgress < 0) this.laneChangeProgress = 0;
    }

    const currentX = this.lanePositions[this.targetLane];
    const targetX = currentX;
    this.objects[0].position.x += (targetX - this.objects[0].position.x) * 0.2;

    // Running animation - swing arms and legs
    if (!this.isJumping && !this.isSliding) {
      this.animationTime += 0.2; // Animation speed

      const swingAmount = 0.6; // How far arms/legs swing
      const armSwing = Math.sin(this.animationTime) * swingAmount;
      const legSwing = Math.sin(this.animationTime) * swingAmount;

      // Arms swing opposite to legs
      this.leftArm.rotation.x = armSwing;
      this.rightArm.rotation.x = -armSwing;

      // Legs swing
      this.leftLeg.rotation.x = legSwing;
      this.rightLeg.rotation.x = -legSwing;

      // Add slight body bob
      this.body.position.y = 0.75 * 0.5 + Math.abs(Math.sin(this.animationTime * 2)) * 0.03;
    } else {
      // Reset animation when jumping or sliding
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.body.position.y = 0.75 * 0.5;
    }

    // Handle jumping
    if (this.isJumping) {
      this.jumpVelocity -= 0.008; // Reduced gravity for longer hang time
      this.objects[0].position.y += this.jumpVelocity;

      if (this.objects[0].position.y <= this.baseY) {
        this.objects[0].position.y = this.baseY;
        this.isJumping = false;
        this.jumpVelocity = 0;
      }
    }

    // Handle sliding
    if (this.isSliding) {
      this.slideTimer--;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
        this.objects[0].scale.y = 1;
        this.objects[0].position.y = this.baseY;
      }
    }
  }

  getBoundingBox() {
    const box = new T.Box3();
    box.setFromObject(this.objects[0]);
    return box;
  }
}

// Obstacle class (Cars moving toward player)
export class Obstacle extends GrObject {
  constructor(lane, type = 'car', position = { x: 0, y: 0, z: 0 }) {
    const group = new T.Group();

    let geometry, material, mesh;

    if (type === 'box') {
      // Overhead obstacle - must slide under
      geometry = new T.BoxGeometry(1.2, 0.4, 1.2);
      material = new T.MeshStandardMaterial({
        color: 0xff4444,
        roughness: 0.5,
        metalness: 0.3
      });
      mesh = new T.Mesh(geometry, material);
      mesh.position.y = 0.8; // Higher up - must slide to avoid

      // Add warning stripes
      const stripeGeom = new T.BoxGeometry(0.2, 0.42, 1.22);
      const stripeMat = new T.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0x444400
      });
      const stripe1 = new T.Mesh(stripeGeom, stripeMat);
      stripe1.position.set(-0.4, 0.8, 0);
      const stripe2 = new T.Mesh(stripeGeom, stripeMat);
      stripe2.position.set(0.4, 0.8, 0);
      group.add(stripe1);
      group.add(stripe2);
    } else if (type === 'barrier') {
      geometry = new T.BoxGeometry(1, 0.5, 0.8);
      material = new T.MeshStandardMaterial({ color: 0xffaa00 });
      mesh = new T.Mesh(geometry, material);
      mesh.position.y = 0.25;
    } else if (type === 'car') {
      // Create realistic car with metallic paint texture
      const createCarTexture = (baseColor) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Base color
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 128, 128);

        // Add metallic shine effect
        const gradient = ctx.createLinearGradient(0, 0, 128, 128);
        gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        return new T.CanvasTexture(canvas);
      };

      // Car shape - made BIGGER for better visibility
      const bodyGeom = new T.BoxGeometry(1.2, 0.8, 2.5);
      const carColors = ['#cc0000', '#00cc00', '#0000cc', '#cccc00', '#cc00cc'];
      const carTexture = createCarTexture(carColors[Math.floor(Math.random() * carColors.length)]);

      const bodyMat = new T.MeshStandardMaterial({
        map: carTexture,
        roughness: 0.3,
        metalness: 0.8
      });
      mesh = new T.Mesh(bodyGeom, bodyMat);
      mesh.position.y = 0.4;

      // Car roof with window texture
      const roofGeom = new T.BoxGeometry(1.0, 0.5, 1.5);
      const windowCanvas = document.createElement('canvas');
      windowCanvas.width = 64;
      windowCanvas.height = 64;
      const winCtx = windowCanvas.getContext('2d');
      winCtx.fillStyle = '#1a1a2e';
      winCtx.fillRect(0, 0, 64, 64);
      // Add shine
      winCtx.fillStyle = 'rgba(255,255,255,0.1)';
      winCtx.fillRect(5, 5, 54, 54);
      const windowTexture = new T.CanvasTexture(windowCanvas);
      const roofMat = new T.MeshStandardMaterial({
        map: windowTexture,
        roughness: 0.2,
        metalness: 0.5
      });
      const roof = new T.Mesh(roofGeom, roofMat);
      roof.position.y = 0.85;
      mesh.add(roof);

      // Add headlights - scaled up
      const headlightGeom = new T.BoxGeometry(0.2, 0.2, 0.05);
      const headlightMat = new T.MeshStandardMaterial({
        color: 0xffffaa,
        emissive: 0xffffaa,
        emissiveIntensity: 0.5
      });
      const leftHeadlight = new T.Mesh(headlightGeom, headlightMat);
      leftHeadlight.position.set(-0.35, 0, 1.3);
      mesh.add(leftHeadlight);
      const rightHeadlight = new T.Mesh(headlightGeom, headlightMat);
      rightHeadlight.position.set(0.35, 0, 1.3);
      mesh.add(rightHeadlight);

      // Rotate car to face toward player (coming at them)
      mesh.rotation.y = Math.PI;
    }

    group.add(mesh);
    group.position.copy(position);

    super(`Obstacle-${lane}-${type}`, group);

    this.lane = lane;
    this.type = type;
    this.canJumpOver = (type === 'barrier');
    this.canSlideUnder = (type === 'box'); // Box is overhead - must slide under
    this.speed = type === 'car' ? 0.25 : 0; // Cars move toward player faster
  }

  update(baseSpeed) {
    // Cars move toward player (negative Z plus their own speed)
    this.objects[0].position.z -= baseSpeed + this.speed;
  }

  getBoundingBox() {
    const box = new T.Box3();
    box.setFromObject(this.objects[0]);
    return box;
  }
}

// Coin class
export class Coin extends GrObject {
  constructor(lane, position = { x: 0, y: 1, z: 0 }) {
    const group = new T.Group();

    // Create coin geometry
    const coinGeometry = new T.CylinderGeometry(0.3, 0.3, 0.1, 16);
    const coinMaterial = new T.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2
    });

    const coin = new T.Mesh(coinGeometry, coinMaterial);
    coin.rotation.z = Math.PI / 2; // Rotate to face player
    group.add(coin);

    group.position.copy(position);

    super(`Coin-${lane}`, group);

    this.lane = lane;
    this.rotationSpeed = 0.05;
    this.collected = false;
  }

  update() {
    // Rotate coin for visual effect
    this.objects[0].children[0].rotation.y += this.rotationSpeed;
  }

  getBoundingBox() {
    const box = new T.Box3();
    box.setFromObject(this.objects[0]);
    return box;
  }
}

// Main Runner Game Controller
export class RunnerGame extends GrObject {
  constructor(params = {}) {
    const group = new T.Group();
    super("RunnerGame", group);

    this.random = new Random(params.seed || 12345);
    this.gridSize = params.gridSize || 16;
    this.blockSize = params.blockSize || 4;
    this.roadWidth = params.roadWidth || 2;
    this.fogParams = params.fogParams;
    this.isNightMode = params.isNightMode || false;

    // Game state
    this.player = new Player();
    this.obstacles = [];
    this.coins = [];
    this.roadSegments = [];
    this.cityBlocks = [];
    this.coinsCollected = 0;

    this.speed = 0.15; // Forward movement speed - increased
    this.distance = 0;
    this.segmentLength = 10;
    this.segmentsAhead = 20;
    this.segmentsBehind = 5;

    // Path curvature parameters
    this.pathAngle = 0; // Current direction angle
    this.nextTurnDistance = 30; // Distance until next turn
    this.turningRadius = 50; // How wide the turns are

    // Generate initial path
    this.pathDirection = { x: 0, z: 1 }; // Start going in +Z direction
    this.currentPosition = { x: 0, z: 0 };

    // Add player to scene
    group.add(this.player.objects[0]);
    this.player.objects[0].position.set(0, 0, 0);

    // Generate initial segments
    this.generateInitialRoad();

    // Create camera
    this.camera = new T.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 3, -5);
    this.camera.lookAt(0, 1, 0);

    this.obstacleSpawnCounter = 0;
    this.obstacleSpawnInterval = 25; // Spawn every N units - more frequent

    this.coinSpawnCounter = 0;
    this.coinSpawnInterval = 15; // Spawn coins more frequently
  }

  generateInitialRoad() {
    for (let i = 0; i < this.segmentsAhead; i++) {
      this.generateRoadSegment(i * this.segmentLength);
      this.generateCityBlocks(i * this.segmentLength);
    }

    // Spawn initial obstacles and coins immediately
    for (let i = 3; i < this.segmentsAhead; i += 3) {
      const zPos = i * this.segmentLength;
      this.spawnObstacle(zPos);

      // Spawn coins less frequently than obstacles
      if (i % 5 === 0) {
        this.spawnCoins(zPos);
      }
    }
  }

  generateRoadSegment(zPosition) {
    // Create road surface with texture
    const roadGeometry = new T.PlaneGeometry(3, this.segmentLength);

    // Create asphalt texture procedurally
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Dark gray asphalt base
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, 256, 256);

    // Add some noise for texture
    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const brightness = Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      ctx.fillRect(x, y, 2, 2);
    }

    const roadTexture = new T.CanvasTexture(canvas);
    roadTexture.wrapS = T.RepeatWrapping;
    roadTexture.wrapT = T.RepeatWrapping;
    roadTexture.repeat.set(1, 4);

    const roadMaterial = new T.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.9,
      metalness: 0.1
    });

    const road = new T.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.01, zPosition);

    this.objects[0].add(road);
    this.roadSegments.push({ mesh: road, z: zPosition });

    // Add lane markers with dashed pattern
    for (let lane = -0.5; lane <= 0.5; lane += 1) {
      // Create dashed lines
      for (let dash = 0; dash < this.segmentLength; dash += 2) {
        const markerGeometry = new T.BoxGeometry(0.1, 0.02, 0.8);
        const markerMaterial = new T.MeshStandardMaterial({
          color: 0xffff00,
          emissive: 0x444400
        });
        const marker = new T.Mesh(markerGeometry, markerMaterial);
        marker.position.set(lane, 0, zPosition - this.segmentLength/2 + dash);
        this.objects[0].add(marker);
      }
    }
  }

  generateCityBlocks(zPosition) {
    // Generate buildings on both sides creating a curving path
    const blockDepth = 3; // Only 3 blocks deep on each side
    const spacing = 6; // Larger spacing between buildings

    // Determine if we should curve the path
    if (this.distance > this.nextTurnDistance) {
      // Time to turn - randomly choose left or right
      const turnDirection = (this.random.next() % 2) * 2 - 1; // -1 or 1
      this.pathAngle += turnDirection * (Math.PI / 8); // Turn by 22.5 degrees
      this.nextTurnDistance = this.distance + 30 + (this.random.next() % 40);
    }

    for (let side = -1; side <= 1; side += 2) { // -1 = left, 1 = right
      for (let depth = 0; depth < blockDepth; depth++) {
        // Apply curve offset based on path angle
        const curveOffset = Math.sin(this.pathAngle) * depth * 2;
        const x = side * (3 + depth * spacing) + curveOffset;
        const z = zPosition + (this.random.next() % this.segmentLength) - this.segmentLength / 2;

        // Use actual procedurally generated skyscrapers
        const buildingWidth = 2 + (this.random.next() % 20) / 10;
        const buildingDepth = 2 + (this.random.next() % 20) / 10;

        const skyscraperData = sampleSkyscraper(this.random, buildingWidth, buildingDepth);
        skyscraperData.x = x;
        skyscraperData.z = z;
        skyscraperData.y = 0;
        skyscraperData.fogParams = this.fogParams;
        skyscraperData.isNightMode = this.isNightMode;

        const skyscraper = new GrSkyscraper(skyscraperData);

        this.objects[0].add(skyscraper.objects[0]);
        this.cityBlocks.push({
          mesh: skyscraper.objects[0],
          z: z,
          grObject: skyscraper
        });
      }
    }
  }

  spawnObstacle(zPosition) {
    // Randomly choose lanes for obstacles, but always leave at least one lane clear
    const lanes = [0, 1, 2];
    const numObstacles = 1 + (this.random.next() % 2); // 1 or 2 obstacles

    // Shuffle lanes
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = this.random.next() % (i + 1);
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }

    // Place obstacles in first numObstacles lanes
    for (let i = 0; i < numObstacles && i < 2; i++) { // Max 2 obstacles to ensure path
      const lane = lanes[i];
      const laneX = this.player.lanePositions[lane];

      // Mix of cars (60%), overhead boxes (25%), and barriers (15%)
      const rand = this.random.next() % 100;
      let type;
      if (rand < 60) {
        type = 'car';
      } else if (rand < 85) {
        type = 'box'; // Overhead - must slide
      } else {
        type = 'barrier'; // Ground - must jump
      }

      const obstacle = new Obstacle(lane, type, new T.Vector3(laneX, 0, zPosition));
      this.objects[0].add(obstacle.objects[0]);
      this.obstacles.push(obstacle);
    }
  }

  spawnCoins(zPosition) {
    // Spawn coins in long lines that switch lanes (Subway Surfers style)
    const pattern = this.random.next() % 4;

    if (pattern === 0) {
      // Long straight line in one lane (10-15 coins)
      const lane = this.random.next() % 3;
      const laneX = this.player.lanePositions[lane];
      const numCoins = 10 + (this.random.next() % 6);
      for (let i = 0; i < numCoins; i++) {
        const coin = new Coin(lane, new T.Vector3(laneX, 1, zPosition + i * 2));
        this.objects[0].add(coin.objects[0]);
        this.coins.push(coin);
      }
    } else if (pattern === 1) {
      // Lane switching pattern - starts in one lane, switches to another
      let currentLane = this.random.next() % 3;
      const targetLane = (currentLane + 1 + (this.random.next() % 2)) % 3;

      for (let i = 0; i < 15; i++) {
        // Gradually switch lanes
        if (i > 5 && i < 10) {
          currentLane = targetLane;
        }
        const laneX = this.player.lanePositions[currentLane];
        const coin = new Coin(currentLane, new T.Vector3(laneX, 1, zPosition + i * 2));
        this.objects[0].add(coin.objects[0]);
        this.coins.push(coin);
      }
    } else if (pattern === 2) {
      // Zigzag pattern with longer segments
      for (let i = 0; i < 12; i++) {
        const lane = Math.floor(i / 4) % 3; // Change lane every 4 coins
        const laneX = this.player.lanePositions[lane];
        const coin = new Coin(lane, new T.Vector3(laneX, 1, zPosition + i * 2));
        this.objects[0].add(coin.objects[0]);
        this.coins.push(coin);
      }
    } else {
      // Wave pattern - left to right to left
      for (let i = 0; i < 15; i++) {
        let lane;
        if (i < 5) lane = 0;
        else if (i < 10) lane = 1;
        else lane = 2;

        const laneX = this.player.lanePositions[lane];
        const coin = new Coin(lane, new T.Vector3(laneX, 1, zPosition + i * 2));
        this.objects[0].add(coin.objects[0]);
        this.coins.push(coin);
      }
    }
  }

  checkCollision() {
    const playerBox = this.player.getBoundingBox();

    for (let obstacle of this.obstacles) {
      const obstacleBox = obstacle.getBoundingBox();

      if (playerBox.intersectsBox(obstacleBox)) {
        // Check if player can avoid
        if (this.player.isJumping && obstacle.canJumpOver) {
          continue; // Player jumped over it
        }
        if (this.player.isSliding && obstacle.canSlideUnder) {
          continue; // Player slid under it
        }

        return true; // Collision!
      }
    }

    return false;
  }

  checkCoinCollection() {
    const playerBox = this.player.getBoundingBox();

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];
      if (!coin.collected) {
        const coinBox = coin.getBoundingBox();

        if (playerBox.intersectsBox(coinBox)) {
          coin.collected = true;
          this.coinsCollected++;
          this.objects[0].remove(coin.objects[0]);
          this.coins.splice(i, 1);
        }
      }
    }
  }

  update(delta) {
    // Update player
    this.player.update(delta);

    // Move everything backward (player moves forward)
    this.distance += this.speed;
    this.obstacleSpawnCounter += this.speed;
    this.coinSpawnCounter += this.speed;

    // Spawn obstacles periodically
    if (this.obstacleSpawnCounter >= this.obstacleSpawnInterval) {
      const spawnZ = this.segmentsAhead * this.segmentLength;
      this.spawnObstacle(spawnZ);
      this.obstacleSpawnCounter = 0;
    }

    // Spawn coins periodically
    if (this.coinSpawnCounter >= this.coinSpawnInterval) {
      const spawnZ = this.segmentsAhead * this.segmentLength;
      this.spawnCoins(spawnZ);
      this.coinSpawnCounter = 0;
    }

    // Move all objects backward
    for (let segment of this.roadSegments) {
      segment.mesh.position.z -= this.speed;
      segment.z -= this.speed;
    }

    for (let block of this.cityBlocks) {
      block.mesh.position.z -= this.speed;
      block.z -= this.speed;
    }

    for (let obstacle of this.obstacles) {
      obstacle.update(this.speed); // Cars move faster toward player
    }

    for (let coin of this.coins) {
      coin.update();
      coin.objects[0].position.z -= this.speed;
    }

    // Remove segments that are too far behind
    this.roadSegments = this.roadSegments.filter(segment => {
      if (segment.z < -this.segmentsBehind * this.segmentLength) {
        this.objects[0].remove(segment.mesh);
        return false;
      }
      return true;
    });

    this.cityBlocks = this.cityBlocks.filter(block => {
      if (block.z < -this.segmentsBehind * this.segmentLength) {
        this.objects[0].remove(block.mesh);
        return false;
      }
      return true;
    });

    this.obstacles = this.obstacles.filter(obstacle => {
      if (obstacle.objects[0].position.z < -10) {
        this.objects[0].remove(obstacle.objects[0]);
        return false;
      }
      return true;
    });

    this.coins = this.coins.filter(coin => {
      if (coin.objects[0].position.z < -10) {
        this.objects[0].remove(coin.objects[0]);
        return false;
      }
      return true;
    });

    // Generate new segments ahead
    const furthestZ = this.roadSegments.length > 0
      ? Math.max(...this.roadSegments.map(s => s.z))
      : 0;

    if (furthestZ < this.segmentsAhead * this.segmentLength) {
      const newZ = furthestZ + this.segmentLength;
      this.generateRoadSegment(newZ);
      this.generateCityBlocks(newZ);
    }

    // Update camera to follow player
    const playerPos = this.player.objects[0].position;
    this.camera.position.x = playerPos.x;
    this.camera.position.y = playerPos.y + 3;
    this.camera.position.z = playerPos.z - 5;
    this.camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z + 2);

    // Check coin collection
    this.checkCoinCollection();

    // Check collision
    if (this.checkCollision()) {
      return true; // Game over
    }

    return false;
  }

  stepWorld(delta, timeOfDay) {
    const gameOver = this.update(delta);
    return gameOver;
  }
}
