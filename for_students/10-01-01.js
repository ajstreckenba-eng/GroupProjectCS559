// TensorFlow.js will be loaded via script tags

const model = handPoseDetection.SupportedModels.MediaPipeHands;
const detectorConfig = {
  runtime: 'mediapipe',
  solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915',
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  modelType: 'lite'
};

// Global variables
let detector;
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const debug = document.getElementById('debug');

// Hand landmark connections for drawing lines between points
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index finger
  [0, 9], [9, 10], [10, 11], [11, 12], // Middle finger
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring finger
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17] // Palm connections
];

// Colors for different parts of the hand - brighter and more vibrant
const COLORS = {
  thumb: '#FF4444',      // Bright Red
  index: '#44FF44',      // Bright Green
  middle: '#4444FF',     // Bright Blue
  ring: '#FFFF44',       // Bright Yellow
  pinky: '#FF44FF',      // Bright Magenta
  palm: '#44FFFF'        // Bright Cyan
};

// Function to get color for a landmark index
function getLandmarkColor(index) {
  if (index >= 1 && index <= 4) return COLORS.thumb;
  if (index >= 5 && index <= 8) return COLORS.index;
  if (index >= 9 && index <= 12) return COLORS.middle;
  if (index >= 13 && index <= 16) return COLORS.ring;
  if (index >= 17 && index <= 20) return COLORS.pinky;
  return COLORS.palm;
}

// Function to draw a single hand
function drawHand(hand) {
  if (!hand || !hand.keypoints) {
    console.warn('Invalid hand data:', hand);
    return;
  }
  
  const nodes = hand.keypoints;
  if (!nodes || nodes.length === 0) {
    console.warn('No landmarks found for hand');
    return;
  }
  
  // Draw connections - much bolder with shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  
  for (const connection of HAND_CONNECTIONS) {
    const [start, end] = connection;
    if (nodes[start] && nodes[end]) {
      const startPoint = nodes[start];
      const endPoint = nodes[end];
      
      if (startPoint.x !== undefined && startPoint.y !== undefined &&
          endPoint.x !== undefined && endPoint.y !== undefined) {
        ctx.moveTo(canvas.width - startPoint.x, startPoint.y);
        ctx.lineTo(canvas.width - endPoint.x, endPoint.y);
      }
    }
  }
  ctx.stroke();
  
  // Reset shadow for landmarks
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Draw landmarks - much larger and bolder
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node && node.x !== undefined && node.y !== undefined) {
      // Draw outer ring for extra visibility
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(canvas.width - node.x, node.y, 14, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw middle ring for contrast
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(canvas.width - node.x, node.y, 12, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw main landmark circle
      ctx.fillStyle = getLandmarkColor(i);
      ctx.beginPath();
      ctx.arc(canvas.width - node.x, node.y, 10, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw landmark number - larger and bolder with outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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
    const hands = await detector.estimateHands(video, estimationConfig);
    
    // Clear previous drawings
    clearCanvas();
    
    // Update debug info
    debug.textContent = `Video: ${video.videoWidth}x${video.videoHeight}\nCanvas: ${canvas.width}x${canvas.height}\nHands detected: ${hands.length}\n`;
    
    // Draw each detected hand
    hands.forEach((hand, index) => {
      const handedness = hand.handedness || 'Unknown';
      const confidence = hand.handednessScore ? hand.handednessScore.toFixed(3) : 'N/A';
      debug.textContent += `Hand ${index + 1}: ${handedness} (confidence: ${confidence})\n`;
      drawHand(hand);
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
    debug.textContent = 'Loading dependencies...';
    console.log('Starting initialization...');
    
    // Check if required libraries are loaded
    console.log('tf:', typeof tf);
    console.log('handPoseDetection:', typeof handPoseDetection);
    
    // Wait for TensorFlow.js to be available
    let attempts = 0;
    while (typeof handPoseDetection === 'undefined' && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        debug.textContent = `Loading dependencies... (${attempts}/100)`;
      }
    }
    
    if (typeof handPoseDetection === 'undefined') {
      throw new Error('TensorFlow.js hand pose detection not loaded after 10 seconds');
    }
    
    // Initialize TensorFlow.js backend
    if (typeof tf !== 'undefined' && tf.backend) {
      debug.textContent = 'Initializing TensorFlow.js backend...';
      await tf.ready();
      console.log('TensorFlow.js backend initialized');
    }
    
    debug.textContent = 'Creating detector...';
    console.log('Creating detector with config:', detectorConfig);
    
    detector = await handPoseDetection.createDetector(model, detectorConfig);
    console.log('Detector created successfully');
    
    // Wait for video to load
    if (video.readyState >= 1) {
      resizeCanvas();
      debug.textContent = 'Model loaded. Starting detection...';
      // Test canvas drawing
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(50, 50, 20, 0, 2 * Math.PI);
      ctx.fill();
      detectAndDraw();
    } else {
      video.addEventListener('loadedmetadata', () => {
        resizeCanvas();
        debug.textContent = 'Model loaded. Starting detection...';
        // Test canvas drawing
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(50, 50, 20, 0, 2 * Math.PI);
        ctx.fill();
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
