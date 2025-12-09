/*jshint esversion: 6 */
// @ts-check

import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { WorldUI } from "../libs/CS559-Framework/WorldUI.js";
import { GrCity } from "./building.js";
import * as T from "../libs/CS559-Three/build/three.module.js";

// Game state management
let world = null;
let gameState = 'start'; // 'start', 'playing', 'paused'

const fogColor = new T.Color(0xffffff);

// Screen elements
const startScreen = document.getElementById('start-screen');
const gameContainer = document.getElementById('game-container');
const pauseScreen = document.getElementById('pause-screen');

// Button elements
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const resumeButton = document.getElementById('resume-button');
const restartButton = document.getElementById('restart-button');

// Initialize the game world
function initGame() {
  // Create the world
  world = new GrWorld({
    width: window.innerWidth,
    height: window.innerHeight,
    where: document.getElementById("div1"),
    renderparams: {
      antialias: true,
    },
  });

  world.groundplane.material.visible = false;

  const bigCity = new GrCity({
    seed: 12345,
    gridSize: 16,
    blockSize: 4,
    roadWidth: 2,
    fogParams: {
      color: fogColor,
      near: 0,
      far: 8,
    },
  });

  world.add(bigCity);
  world.scene.background = fogColor;

  // Handle resize to keep canvas visible
  window.addEventListener("resize", () => {
    if (world && world.renderer && world.camera) {
      world.camera.aspect = window.innerWidth / window.innerHeight;
      world.camera.updateProjectionMatrix();
      world.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });
}

// Start the game
function startGame() {
  gameState = 'playing';
  startScreen.style.display = 'none';
  pauseScreen.style.display = 'none';
  gameContainer.style.display = 'block';

  if (!world) {
    initGame();
    world.go();
  } else {
    world.go();
  }
}

// Pause the game
function pauseGame() {
  if (gameState === 'playing') {
    gameState = 'paused';
    gameContainer.style.display = 'none';
    pauseScreen.style.display = 'flex';

    if (world) {
      world.stop();
    }
  }
}

// Resume the game
function resumeGame() {
  if (gameState === 'paused') {
    gameState = 'playing';
    pauseScreen.style.display = 'none';
    gameContainer.style.display = 'block';

    if (world) {
      world.go();
    }
  }
}

// Restart the game
function restartGame() {
  if (world) {
    world.stop();
  }

  // Clear the game container
  const div1 = document.getElementById('div1');
  if (div1) {
    div1.innerHTML = '';
  }

  world = null;
  gameState = 'start';

  pauseScreen.style.display = 'none';
  gameContainer.style.display = 'none';
  startScreen.style.display = 'flex';
}

// Event listeners
startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', pauseGame);
resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', restartGame);

// Keyboard controls
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
    if (gameState === 'playing') {
      pauseGame();
    } else if (gameState === 'paused') {
      resumeGame();
    }
  }
});

// CS559 2025 Workbook
