// TensorFlow.js Pose Detection Demo
// Based on: https://blog.tensorflow.org/2018/05/real-time-human-pose-estimation-in.html

// Global variables
let detector;
let video;
let canvas;
let ctx;
let debug;

// MoveNet model configuration
// Use BlazePose with proper MediaPipe configuration
const model = poseDetection.SupportedModels.BlazePose;
const detectorConfig = {
  runtime: 'mediapipe',
  solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4.1624666670/',
  modelType: 'lite'
};


// Pose keypoint connections for drawing skeleton (BlazePose standard 33 keypoints)
// Based on the reference image showing correct BlazePose keypoint structure
const POSE_CONNECTIONS = [
  // Face connections
  [0, 1], [0, 4], // nose to eyes
  [1, 2], [2, 3], // left eye
  [4, 5], [5, 6], // right eye
  [0, 7], [0, 8], // nose to outer eye points
  [9, 10], // mouth
  
  // Torso connections
  [11, 12], // shoulders
  [11, 23], [12, 24], // shoulders to hips
  [23, 24], // hips
  
  // Left arm (viewer's right)
  [11, 13], // left shoulder to elbow
  [13, 15], // left elbow to wrist
  [15, 17], [15, 19], [15, 21], // left wrist to fingers
  
  // Right arm (viewer's left)
  [12, 14], // right shoulder to elbow
  [14, 16], // right elbow to wrist
  [16, 18], [16, 20], [16, 22], // right wrist to fingers
  
  // Left leg (viewer's right)
  [23, 25], // left hip to knee
  [25, 27], // left knee to ankle
  [27, 29], [27, 31], // left ankle to foot
  
  // Right leg (viewer's left)
  [24, 26], // right hip to knee
  [26, 28], // right knee to ankle
  [28, 30], [28, 32], // right ankle to foot
];

// Colors for different body parts
const COLORS = {
  body: '#00FF00',         // Green for all body parts
  face: '#FF0000'          // Red for face only
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

// Function to draw pose skeleton
function drawPose(pose) {
  if (!pose) {
    return;
  }
  
  // Try different possible keypoint properties
  const keypoints = pose.keypoints || pose.landmarks || pose.points || [];
  
  if (!keypoints || keypoints.length === 0) {
    console.log('No keypoints found in pose object:', pose);
    return;
  }
  
  // Draw connections (skeleton)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  for (const connection of POSE_CONNECTIONS) {
    const [startIdx, endIdx] = connection;
    const startPoint = keypoints[startIdx];
    const endPoint = keypoints[endIdx];
    
    if (startPoint && endPoint && startPoint.score > 0.1 && endPoint.score > 0.1) {
      ctx.strokeStyle = getConnectionColor(connection);
      ctx.beginPath();
      ctx.moveTo(canvas.width - startPoint.x, startPoint.y);
      ctx.lineTo(canvas.width - endPoint.x, endPoint.y);
      ctx.stroke();
    }
  }
  
  // Reset shadow for keypoints
  ctx.shadowColor = 'transparent';
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
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw inner circle
      ctx.fillStyle = '#000000';
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
  canvas.style.width = videoRect.width + 'px';
  canvas.style.height = videoRect.height + 'px';
}

// Main detection and drawing function
async function detectAndDraw() {
  if (!detector) {
    debug.textContent = 'Waiting for detector...';
    requestAnimationFrame(detectAndDraw);
    return;
  }
  
  if (!video.videoWidth || !video.videoHeight) {
    debug.textContent = 'Waiting for video dimensions...';
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
      console.error('Error detecting poses on video:', error);
      poses = [];
    }
    
    // Clear previous drawings
    clearCanvas();
    
    // Update debug info (simplified)
    if (poses.length > 0) {
      const visibleKeypoints = poses[0].keypoints ? poses[0].keypoints.filter(kp => kp && kp.score > 0.3).length : 0;
      debug.textContent = `Poses detected: ${poses.length}, Visible keypoints: ${visibleKeypoints}/33`;
    } else {
      debug.textContent = 'No poses detected';
    }
    
    // Draw each detected pose
    poses.forEach((pose, index) => {
      drawPose(pose);
    });
    
  } catch (error) {
    debug.textContent = `Detection error: ${error.message}`;
    console.error('Detection error:', error);
  }
  
  // Continue the detection loop
  requestAnimationFrame(detectAndDraw);
}

// Initialize everything
async function init() {
  try {
    // Get DOM elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    debug = document.getElementById('debug');
    
    if (!video || !canvas || !debug) {
      throw new Error('Required DOM elements not found');
    }
    
    debug.textContent = 'Loading BlazePose model...';
    console.log('Starting BlazePose initialization...');
    
    // Check if TensorFlow.js is loaded
    console.log('tf:', typeof tf);
    console.log('poseDetection:', typeof poseDetection);
    
    // Wait for TensorFlow.js and PoseNet to be available
    let attempts = 0;
    while ((typeof tf === 'undefined' || typeof poseDetection === 'undefined') && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        debug.textContent = `Loading dependencies... (${attempts}/100)`;
      }
    }
    
    if (typeof tf === 'undefined') {
      throw new Error('TensorFlow.js not loaded');
    }
    
    if (typeof poseDetection === 'undefined') {
      throw new Error('Pose detection not loaded');
    }
    
    // Initialize TensorFlow.js backend
    debug.textContent = 'Initializing TensorFlow.js backend...';
    await tf.ready();
    console.log('TensorFlow.js backend initialized');
    
    // Load BlazePose model
    debug.textContent = 'Loading BlazePose model...';
    console.log('Loading BlazePose model...');
    console.log('Model:', model);
    console.log('Detector config:', detectorConfig);
    
    try {
      detector = await poseDetection.createDetector(model, detectorConfig);
      console.log('BlazePose model loaded successfully');
    } catch (error) {
      console.error('Error creating detector:', error);
      throw new Error(`Failed to create BlazePose detector: ${error.message}`);
    }
    
    // Wait for video to load
    if (video.readyState >= 1) {
      resizeCanvas();
      debug.textContent = 'Model loaded. Starting pose detection...';
      detectAndDraw();
    } else {
      video.addEventListener('loadedmetadata', () => {
        resizeCanvas();
        debug.textContent = 'Model loaded. Starting pose detection...';
        detectAndDraw();
      });
    }
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
    
  } catch (error) {
    debug.textContent = `Error: ${error.message}`;
    console.error('Initialization error:', error);
    console.error('Error stack:', error.stack);
  }
}

// Start the application when the page loads
window.addEventListener('DOMContentLoaded', init);
// CS559 2025 Workbook
