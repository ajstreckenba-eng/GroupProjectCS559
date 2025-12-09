/*jshint esversion: 6 */
// @ts-check

import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { WorldUI } from "../libs/CS559-Framework/WorldUI.js";
import { GrCity } from "./building.js";
import { RunnerGame } from "./runner.js";
import * as T from "../libs/CS559-Three/build/three.module.js";

// Game state management
let world = null;
let runnerGame = null;
let gameState = "start"; // 'start', 'playing', 'paused'
let currentScore = 0;
let highScore = parseInt(localStorage.getItem("cityRunnerHighScore")) || 0;
let animationFrameId = null;
let isNightMode = false; // Day mode by default
let characterMode = "character1"; // Default: girl runs, jogger chases

// Screen elements
const startScreen = document.getElementById("start-screen");
const gameContainer = document.getElementById("game-container");
const pauseScreen = document.getElementById("pause-screen");

// Button elements
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const resumeButton = document.getElementById("resume-button");
const restartButton = document.getElementById("restart-button");
const dayModeButton = document.getElementById("day-mode-button");
const nightModeButton = document.getElementById("night-mode-button");
const character1Button = document.getElementById("character1-button");
const character2Button = document.getElementById("character2-button");

// Score elements
const scoreValue = document.getElementById("score-value");
const pauseScoreValue = document.getElementById("pause-score-value");
const pauseHighScoreValue = document.getElementById("pause-high-score-value");
const highScoreValue = document.getElementById("high-score-value");

// Initialize high score display
highScoreValue.textContent = highScore;

// Initialize the game world
function initGame() {
  // make the world
  world = new GrWorld({
    width: window.innerWidth,
    height: window.innerHeight,
    where: document.getElementById("div1"),
    renderparams: {
      antialias: true,
    },
  });

  world.groundplane.material.visible = false;

  let fogColor = isNightMode ? new T.Color(0x0a0a1a) : new T.Color(0xffffff);

  // Create runner game instead of city
  runnerGame = new RunnerGame({
    seed: 12345,
    gridSize: 16,
    blockSize: 4,
    roadWidth: 3,
    fogParams: {
      color: fogColor,
      near: 0,
      far: 10,
    },
    isNightMode: isNightMode,
    characterMode: characterMode,
  });

  world.add(runnerGame);

  world.scene.background = fogColor;

  // Lighting based on mode
  if (isNightMode) {
    // Darker ambient light for night
    const ambientLight = new T.AmbientLight(0x6666aa, 0.3);
    world.scene.add(ambientLight);

    // Moonlight (cooler, dimmer directional light)
    const moonlight = new T.DirectionalLight(0xaaccff, 0.4);
    moonlight.position.set(10, 20, 10);
    world.scene.add(moonlight);
  } else {
    // Day lighting
    const ambientLight = new T.AmbientLight(0xffffff, 0.6);
    world.scene.add(ambientLight);

    const directionalLight = new T.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    world.scene.add(directionalLight);
  }

  // Use the runner game camera
  world.camera = runnerGame.camera;

  // Handle window resize
  window.addEventListener("resize", () => {
    if (world && world.renderer && world.camera) {
      world.camera.aspect = window.innerWidth / window.innerHeight;
      world.camera.updateProjectionMatrix();
      world.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });
}

function highlight(obName) {
  const toHighlight = world.objects.find((ob) => ob.name === obName);
  if (toHighlight) {
    toHighlight.highlighted = true;
  } else {
    throw `no object named ${obName} for highlighting!`;
  }
}

// Update score display
function updateScore(score) {
  currentScore = score;
  scoreValue.textContent = currentScore;
}

// Update high score
function updateHighScore() {
  if (currentScore > highScore) {
    highScore = currentScore;
    localStorage.setItem("cityRunnerHighScore", highScore);
    highScoreValue.textContent = highScore;
  }
}

// Game loop
function gameLoop() {
  if (gameState !== "playing") return;

  // Update runner game
  if (runnerGame) {
    const gameOver = runnerGame.stepWorld(16.67, 0);

    // Update score based on distance and coins
    const score =
      Math.floor(runnerGame.distance) + runnerGame.coinsCollected * 10;
    updateScore(score);

    // Update coin display
    const coinValue = document.getElementById("coin-value");
    if (coinValue) {
      coinValue.textContent = runnerGame.coinsCollected;
    }

    if (gameOver) {
      handleGameOver();
      return;
    }
  }

  // Render
  if (world && world.renderer && world.scene && world.camera) {
    world.renderer.render(world.scene, world.camera);
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// Handle game over
function handleGameOver() {
  gameState = "paused";
  updateHighScore();

  // Show game over in pause screen
  pauseScoreValue.textContent = currentScore;
  pauseHighScoreValue.textContent = highScore;

  gameContainer.style.display = "none";
  pauseScreen.style.display = "flex";

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
}

// Start the game
function startGame() {
  gameState = "playing";
  currentScore = 0;
  updateScore(0);

  startScreen.style.display = "none";
  pauseScreen.style.display = "none";
  gameContainer.style.display = "block";

  if (!world) {
    initGame();
  }

  // Start game loop
  gameLoop();
}

// Pause the game
function pauseGame() {
  if (gameState === "playing") {
    gameState = "paused";
    gameContainer.style.display = "none";
    pauseScreen.style.display = "flex";

    // Update pause screen scores
    pauseScoreValue.textContent = currentScore;
    pauseHighScoreValue.textContent = highScore;

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  }
}

// Resume the game
function resumeGame() {
  if (gameState === "paused") {
    gameState = "playing";
    pauseScreen.style.display = "none";
    gameContainer.style.display = "block";

    gameLoop();
  }
}

// Restart the game
function restartGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

  // Update high score if needed
  updateHighScore();

  // Clear the game container
  const div1 = document.getElementById("div1");
  if (div1) {
    div1.innerHTML = "";
  }

  world = null;
  runnerGame = null;
  gameState = "start";
  currentScore = 0;

  pauseScreen.style.display = "none";
  gameContainer.style.display = "none";
  startScreen.style.display = "flex";
}

// Mode selector event listeners
dayModeButton.addEventListener("click", () => {
  isNightMode = false;
  dayModeButton.classList.add("active");
  nightModeButton.classList.remove("active");
});

nightModeButton.addEventListener("click", () => {
  isNightMode = true;
  nightModeButton.classList.add("active");
  dayModeButton.classList.remove("active");
});

function setCharacterMode(mode) {
  characterMode = mode;
  if (mode === "character1") {
    character1Button.classList.add("active");
    character2Button.classList.remove("active");
  } else {
    character2Button.classList.add("active");
    character1Button.classList.remove("active");
  }
}

character1Button.addEventListener("click", () =>
  setCharacterMode("character1"),
);
character2Button.addEventListener("click", () =>
  setCharacterMode("character2"),
);

// Event listeners
startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
restartButton.addEventListener("click", restartGame);

// Keyboard controls
document.addEventListener("keydown", (event) => {
  // Pause controls
  if (event.key === "Escape" || event.key === "p" || event.key === "P") {
    if (gameState === "playing") {
      pauseGame();
    } else if (gameState === "paused") {
      resumeGame();
    }
    return;
  }

  // Game controls
  if (gameState === "playing" && runnerGame && runnerGame.player) {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        runnerGame.player.moveLeft();
        break;
      case "ArrowRight":
        event.preventDefault();
        runnerGame.player.moveRight();
        break;
      case "ArrowUp":
        event.preventDefault();
        runnerGame.player.jump();
        break;
      case "ArrowDown":
        event.preventDefault();
        runnerGame.player.slide(); // start/maintain slide while held
        break;
    }
  }
});

// Stop sliding on key release
document.addEventListener("keyup", (event) => {
  if (gameState === "playing" && runnerGame && runnerGame.player) {
    if (event.key === "ArrowDown") {
      runnerGame.player.releaseSlide();
    }
  }
});

// CS559 2025 Workbook
