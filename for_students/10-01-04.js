import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import { GrCube } from "../libs/CS559-Framework/SimpleObjects.js";

// three things for making a cube
import * as T from "../libs/CS559-Three/build/three.module.js";

// Global variables
let detector;
let world;
let video;
let canvas;
let ctx;
let debug;
let poseGrObject; // GrObject wrapper for the pose group
let poseGroup; // Group to hold all pose geometry
let sphereMeshes = []; // Array to hold sphere meshes for keypoints
let cylinderMeshes = []; // Array to hold cylinder meshes for connections
let poseInitialized = false; // Flag to track if pose geometry has been created

const model = poseDetection.SupportedModels.BlazePose;
const detectorConfig = {
  runtime: "mediapipe",
  solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4.1624666670/",
  modelType: "full", // Changed from 'lite' to 'full' for better 3D support
  enableSmoothing: true,
  enableSegmentation: false,
};

// Pose keypoint connections for drawing skeleton (BlazePose standard 33 keypoints)
// Based on the reference image showing correct BlazePose keypoint structure
const POSE_CONNECTIONS = [
  // Face connections
  [0, 1],
  [0, 4], // nose to eyes
  [1, 2],
  [2, 3], // left eye
  [4, 5],
  [5, 6], // right eye
  [0, 7],
  [0, 8], // nose to outer eye points
  [9, 10], // mouth

  // Torso connections
  [11, 12], // shoulders
  [11, 23],
  [12, 24], // shoulders to hips
  [23, 24], // hips

  // Left arm (viewer's right)
  [11, 13], // left shoulder to elbow
  [13, 15], // left elbow to wrist
  [15, 17],
  [15, 19],
  [15, 21], // left wrist to fingers

  // Right arm (viewer's left)
  [12, 14], // right shoulder to elbow
  [14, 16], // right elbow to wrist
  [16, 18],
  [16, 20],
  [16, 22], // right wrist to fingers

  // Left leg (viewer's right)
  [23, 25], // left hip to knee
  [25, 27], // left knee to ankle
  [27, 29],
  [27, 31], // left ankle to foot

  // Right leg (viewer's left)
  [24, 26], // right hip to knee
  [26, 28], // right knee to ankle
  [28, 30],
  [28, 32], // right ankle to foot
];

// Colors for different body parts
const COLORS = {
  body: "#00FF00", // Green for all body parts
  face: "#FF0000", // Red for face only
};

// Function to get color for a connection
function getConnectionColor(connection) {
  const [start, end] = connection;

  // Face and head connections (0-10: face, eyes, mouth) - use red
  if ((start >= 0 && start <= 10) || (end >= 0 && end <= 10)) {
    return COLORS.face;
  }

  // All other body parts - use green
  return COLORS.body;
}

// Function to get color for a keypoint index
function getKeypointColor(index) {
  // Face and head (0-10) - use red
  if (index >= 0 && index <= 10) return COLORS.face;
  // All other body parts - use green
  return COLORS.body;
}

// >>>>>>>>>>>> For student's implementation <<<<<<<<<<<
// Function to create 3D pose visualization
function get3DPose(pose) {
  if (!poseInitialized) {
    poseGroup = new T.Group();
    poseGroup.position.y = 10;

    for (let i = 0; i < 33; i++) {
      const sphereGeometry = new T.SphereGeometry(0.1, 16, 16);
      const sphereMaterial = new T.MeshStandardMaterial({
        color: getKeypointColor(i),
      });
      const sphere = new T.Mesh(sphereGeometry, sphereMaterial);
      sphereMeshes.push(sphere);
      poseGroup.add(sphere);
    }

    for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
      const cylinderGeometry = new T.CylinderGeometry(0.05, 0.05, 1, 8);
      const connection = POSE_CONNECTIONS[i];
      const color = getConnectionColor(connection);
      const cylinderMaterial = new T.MeshStandardMaterial({ color: color });
      const cylinder = new T.Mesh(cylinderGeometry, cylinderMaterial);
      cylinderMeshes.push(cylinder);
      poseGroup.add(cylinder);
    }

    poseGrObject = new GrObject("pose", poseGroup);
    world.add(poseGrObject);

    poseInitialized = true;
  }

  if (pose.keypoints3D) {
    pose.keypoints3D.forEach((keypoint, index) => {
      if (sphereMeshes[index]) {
        sphereMeshes[index].position.set(
          keypoint.x * 10, // Scale up for visibility
          -keypoint.y * 10, // Flip Y axis
          keypoint.z * 10,
        );
      }
    });

    POSE_CONNECTIONS.forEach((connection, index) => {
      const startIdx = connection[0];
      const endIdx = connection[1];

      const start = pose.keypoints3D[startIdx];
      const end = pose.keypoints3D[endIdx];

      if (start && end && cylinderMeshes[index]) {
        const cylinder = cylinderMeshes[index];

        const midX = ((start.x + end.x) / 2) * 10;
        const midY = (-(start.y + end.y) / 2) * 10;
        const midZ = ((start.z + end.z) / 2) * 10;

        const dx = (end.x - start.x) * 10;
        const dy = -(end.y - start.y) * 10;
        const dz = (end.z - start.z) * 10;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        cylinder.position.set(midX, midY, midZ);

        cylinder.scale.y = length;

        const direction = new T.Vector3(dx, dy, dz).normalize();
        const up = new T.Vector3(0, 1, 0);

        const quaternion = new T.Quaternion();
        quaternion.setFromUnitVectors(up, direction);
        cylinder.setRotationFromQuaternion(quaternion);
      }
    });
  }
}

// Function to draw pose skeleton
function drawPose(pose) {
  if (!pose) {
    return;
  }

  // Try different possible keypoint properties
  const keypoints = pose.keypoints || pose.landmarks || pose.points || [];

  if (!keypoints || keypoints.length === 0) {
    console.log("No keypoints found in pose object:", pose);
    return;
  }

  // Draw connections (skeleton)
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const connection of POSE_CONNECTIONS) {
    const [startIdx, endIdx] = connection;
    const startPoint = keypoints[startIdx];
    const endPoint = keypoints[endIdx];

    if (
      startPoint &&
      endPoint &&
      startPoint.score > 0.1 &&
      endPoint.score > 0.1
    ) {
      ctx.strokeStyle = getConnectionColor(connection);
      ctx.beginPath();
      ctx.moveTo(canvas.width - startPoint.x, startPoint.y);
      ctx.lineTo(canvas.width - endPoint.x, endPoint.y);
      ctx.stroke();
    }
  }

  // Reset shadow for keypoints
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Draw keypoints
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    // Draw all keypoints regardless of confidence for debugging
    if (keypoint && keypoint.x !== undefined && keypoint.y !== undefined) {
      const x = canvas.width - keypoint.x;
      const y = keypoint.y;

      // Use different colors based on confidence
      const confidence = keypoint.score || 0;
      const alpha = Math.max(0.3, confidence);

      // Draw outer ring for visibility
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw inner circle
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw main keypoint with confidence-based color
      const color = getConnectionColor([i, i]);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Draw keypoint number
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(i.toString(), x, y);
    }
  }
}

// Function to clear canvas
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Function to resize canvas to match video
function resizeCanvas() {
  const videoRect = video.getBoundingClientRect();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.style.width = videoRect.width + "px";
  canvas.style.height = videoRect.height + "px";
}

// Main detection and drawing function
async function detectAndDraw() {
  if (!detector) {
    debug.textContent = "Waiting for detector...";
    requestAnimationFrame(detectAndDraw);
    return;
  }

  if (!video.videoWidth || !video.videoHeight) {
    debug.textContent = "Waiting for video dimensions...";
    requestAnimationFrame(detectAndDraw);
    return;
  }

  try {
    const estimationConfig = { flipHorizontal: true };

    // Try detecting poses on video
    let poses;
    try {
      poses = await detector.estimatePoses(video, estimationConfig);
    } catch (error) {
      console.error("Error detecting poses on video:", error);
      poses = [];
    }

    // Clear previous drawings
    clearCanvas();

    // Update debug info
    debug.textContent = `Video: ${video.videoWidth}x${video.videoHeight}\nPoses detected: ${poses.length}\n`;

    // Create 3D visualization for each detected pose
    poses.forEach((pose, index) => {
      const confidence = pose.score ? pose.score.toFixed(3) : "N/A";
      debug.textContent += `Pose ${index + 1}: confidence ${confidence}\n`;
      get3DPose(pose);
    });
  } catch (error) {
    debug.textContent = `Detection error: ${error.message}`;
    console.error("Detection error:", error);
  }

  // Continue the detection loop
  requestAnimationFrame(detectAndDraw);
}

// Initialize everything
async function init() {
  try {
    debug.textContent = "Loading dependencies...";
    console.log("Starting initialization...");

    // Wait for TensorFlow.js to be available
    let attempts = 0;
    while (typeof poseDetection === "undefined" && attempts < 100) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        debug.textContent = `Loading dependencies... (${attempts}/100)`;
      }
    }

    if (typeof poseDetection === "undefined") {
      throw new Error(
        "TensorFlow.js pose detection not loaded after 10 seconds",
      );
    }

    // Initialize TensorFlow.js backend
    if (typeof tf !== "undefined" && tf.backend) {
      debug.textContent = "Initializing TensorFlow.js backend...";
      await tf.ready();
      console.log("TensorFlow.js backend initialized");
    }

    debug.textContent = "Creating detector...";
    console.log("Creating detector with config:", detectorConfig);

    detector = await poseDetection.createDetector(model, detectorConfig);
    console.log("Detector created successfully");

    // Wait for video to load
    if (video.readyState >= 1) {
      debug.textContent = "Model loaded. Starting detection...";
      detectAndDraw();
    } else {
      video.addEventListener("loadedmetadata", () => {
        debug.textContent = "Model loaded. Starting detection...";
        detectAndDraw();
      });
    }
  } catch (error) {
    debug.textContent = `Error: ${error.message}`;
    console.error("Initialization error:", error);
    console.error("Error stack:", error.stack);
  }
}

// @@Snippet:makeworld
// Initialize the 3D world
world = new GrWorld({
  groundplanecolor: "gray",
  where: document.getElementById("div1"),
});

// Get video and debug elements
video = document.getElementById("video");
canvas = document.getElementById("canvas");
ctx = canvas.getContext("2d");
debug = document.getElementById("debug");

// Add some lighting to better see the pose
const ambientLight = new T.AmbientLight(0x404040, 0.6);
world.add(new GrObject("ambient-light", ambientLight));

const directionalLight = new T.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
world.add(new GrObject("directional-light", directionalLight));

// run the animation/interaction loop
world.go();

// Start pose detection initialization
init();
// @@Snippet:end
// CS559 2025 Workbook
