import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject} from "../libs/CS559-Framework/GrObject.js";
import { GrCube } from "../libs/CS559-Framework/SimpleObjects.js";
import { GLTFLoader } from "../libs/CS559-Three/examples/jsm/loaders/GLTFLoader.js";

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

// --- NEW Globals for GLB Model ---
let glbModel; // Will hold the loaded GLB scene
let glbBones = {}; // Map to store quick access to bones
let bindDirections = {}; // Store the original "T-Pose" direction of each bone
let initialRotations = {}; // Store initial bone rotations
let initialPositions = {}; // Store initial bone positions
// ---------------------------------

// BlazePose model configuration
const model = poseDetection.SupportedModels.BlazePose;
const detectorConfig = {
  runtime: 'mediapipe',
  solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4.1624666670/',
  modelType: 'full', // Changed from 'lite' to 'full' for better 3D support
  enableSmoothing: true,
  enableSegmentation: false
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

// Function to get color for a keypoint index
function getKeypointColor(index) {
  // Face and head (0-10) - use red
  if (index >= 0 && index <= 10) return COLORS.face;
  // All other body parts - use green
  return COLORS.body;
}

// --- NEW BONE MAPPING AND ANIMATION FUNCTIONS ---

/**
 * Maps bone names to the BlazePose keypoint indices that define them.
 * The bone "points" from the 'start' keypoint to the 'end' keypoint.
 * * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * !!  YOU MUST UPDATE THE 'boneName' VALUES TO MATCH YOUR GLB MODEL !!!  !!
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * * The `bindDir` is the vector direction of the bone in its default T-Pose.
 * (e.g., LeftArm points +X, RightArm points -X, Legs point -Y)
 * This example map is based on a standard Mixamo T-Pose rig.
 */
const BONE_KEYPOINT_MAP = {
    // Spine - Actual directions from the model
    Hips:       { boneName: "Hips_03",       start: 'mid_hip',   end: 'mid_shoulder', bindDir: new T.Vector3(-1, 0, 0) },
    Spine:      { boneName: "Spine0_04",     start: 'mid_hip',   end: 'mid_shoulder', bindDir: new T.Vector3(1, 0, 0) },
    
    // Left Arm - Actual directions from the model
    LeftArm:    { boneName: "LArm_027",      start: 11, end: 13, bindDir: new T.Vector3(0.999, 0, -0.052) },
    LeftForeArm:{ boneName: "LForeArm_028",  start: 13, end: 15, bindDir: new T.Vector3(0.999, 0.010, 0.035) },
    
    // Right Arm - Actual directions from the model
    RightArm:   { boneName: "RArm_047",      start: 12, end: 14, bindDir: new T.Vector3(0.999, 0, -0.052) },
    RightForeArm:{ boneName: "RForeArm_048", start: 14, end: 16, bindDir: new T.Vector3(0.999, -0.010, 0.035) },

    // Left Leg - Actual directions from the model
    LeftUpLeg:  { boneName: "LThigh_068",    start: 23, end: 25, bindDir: new T.Vector3(1, 0, 0) },
    LeftLeg:    { boneName: "LLeg_069",      start: 25, end: 27, bindDir: new T.Vector3(1, 0, -0.029) },

    // Right Leg - Actual directions from the model
    RightUpLeg: { boneName: "RThigh_072",    start: 24, end: 26, bindDir: new T.Vector3(1, 0, 0) },
    RightLeg:   { boneName: "RLeg_073",      start: 26, end: 28, bindDir: new T.Vector3(1, 0, -0.029) },
};

/**
 * Traverses the skeleton and populates the `glbBones` map.
 * Also stores initial bone states and detects actual bind pose directions.
 * @param {T.SkinnedMesh} mesh 
 */
function mapBones(mesh) {
    const boneMap = BONE_KEYPOINT_MAP;
    
    // Log all bone names to help with mapping
    console.log(`All bones in model: ${mesh.skeleton.bones.map(b => b.name).join(', ')}`);

    // First pass: map the bones and store initial states
    mesh.skeleton.bones.forEach(bone => {
        for (const [key, value] of Object.entries(boneMap)) {
            if (bone.name === value.boneName) {
                console.log(`Mapping bone: ${bone.name} to ${key}`);
                glbBones[key] = bone;
                
                // Store initial rotation and position
                initialRotations[key] = bone.quaternion.clone();
                initialPositions[key] = bone.position.clone();
                console.log(`Initial rotation for ${key}: (${initialRotations[key].x.toFixed(3)}, ${initialRotations[key].y.toFixed(3)}, ${initialRotations[key].z.toFixed(3)}, ${initialRotations[key].w.toFixed(3)})`);
                console.log(`Initial position for ${key}: (${initialPositions[key].x.toFixed(3)}, ${initialPositions[key].y.toFixed(3)}, ${initialPositions[key].z.toFixed(3)})`);
                break;
            }
        }
    });

    // Second pass: update bind directions with actual detected directions
    for (const [key, bone] of Object.entries(glbBones)) {
        if (bone.children.length > 0) {
            // Find the first bone child
            for (let child of bone.children) {
                if (child.isBone) {
                    // Calculate direction from parent to child in local space
                    const direction = child.position.clone().normalize();
                    // Update the bind direction with the actual direction
                    console.log(`Bind direction for ${key}: (${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`);
                    bindDirections[key] = direction;
                    break;
                }
            }
        }
    }

    console.log(`Mapped ${Object.keys(glbBones).length} bones successfully`);
}

/**
 * Helper to get a keypoint's position as a T.Vector3.
 * Note: Only used for calculating directions, not absolute positions.
 * Transforms from BlazePose coordinates to model coordinates.
 * @param {Array} keypoints - The keypoints3D array
 * @param {number | 'mid_hip' | 'mid_shoulder'} index - The index or name
 */
function getKPVector(keypoints, index) {
    let x, y, z;
    
    if (typeof index === 'number') {
        const kp = keypoints[index];
        if (!kp) return new T.Vector3();
        x = kp.x;
        y = kp.y;
        z = kp.z || 0;
    } else if (index === 'mid_hip') {
        const p1 = keypoints[23];
        const p2 = keypoints[24];
        if (!p1 || !p2) return new T.Vector3();
        x = (p1.x + p2.x) / 2;
        y = (p1.y + p2.y) / 2;
        z = p1.z !== undefined ? (p1.z + p2.z) / 2 : 0;
    } else if (index === 'mid_shoulder') {
        const p1 = keypoints[11];
        const p2 = keypoints[12];
        if (!p1 || !p2) return new T.Vector3();
        x = (p1.x + p2.x) / 2;
        y = (p1.y + p2.y) / 2;
        z = p1.z !== undefined ? (p1.z + p2.z) / 2 : 0;
    } else {
        return new T.Vector3();
    }
    
    // Transform from BlazePose coords to Model coords
    // BlazePose (Three.js standard): +X=right, +Y=up, +Z=forward
    // Model coordinate system:       +X=up,    +Y=right, +Z=forward
    // 
    // Coordinate system rotation (90° around Z axis):
    // Model_X = BlazePose_Y  (BlazePose up → Model up)
    // Model_Y = BlazePose_X  (BlazePose right → Model right)
    // Model_Z = BlazePose_Z  (BlazePose forward → Model forward)
    //
    // Also apply camera mirroring (negate X for left/right flip)
    return new T.Vector3(-y, x, -z);
    // return new T.Vector3(-y, x, -z);
}

// Create these once to avoid re-allocating in the loop
const targetDir = new T.Vector3();

/**
 * Calculates the local rotation for a bone.
 * @param {T.Bone} bone - The bone to rotate
 * @param {T.Vector3} v_start - The world-space start vector (from keypoint)
 * @param {T.Vector3} v_end - The world-space end vector (from keypoint)
 * @param {T.Vector3} bindDir - The original T-Pose direction of this bone
 * @returns {T.Quaternion} The calculated local rotation
 */
function getLocalRotation(bone, v_start, v_end, bindDir) {
    // Calculate the target direction from keypoints
    targetDir.subVectors(v_end, v_start).normalize();
    
    // Create a quaternion that rotates from the bind direction to the target direction
    const rotation = new T.Quaternion().setFromUnitVectors(bindDir, targetDir);
    
    return rotation;
}

/**
 * Helper to rotate a bone to point towards a target direction
 * Properly accounts for initial bone rotation and parent transforms
 */
function rotateBone(boneKey, targetDir, smoothing = 0.2) {
    const bone = glbBones[boneKey];
    const bindDir = bindDirections[boneKey];
    const initialRot = initialRotations[boneKey];
    
    if (!bone || !targetDir || !bindDir || !initialRot) return;
    
    // 1. Calculate the rotation needed to align bind direction with target direction
    const deltaRotation = new T.Quaternion().setFromUnitVectors(bindDir, targetDir);
    
    // 2. Apply this rotation relative to the initial bone rotation
    // Final rotation = deltaRotation * initialRotation
    const targetRotation = deltaRotation.multiply(initialRot.clone());
    
    // 3. Apply smoothing for more natural movement
    bone.quaternion.slerp(targetRotation, smoothing);
}

/**
 * Main function to animate the GLB model from a pose.
 * @param {object} pose 
 */
function animateModel(pose) {
    if (!pose || !pose.keypoints3D || !glbModel) {
        return;
    }

    try {
        const kps = pose.keypoints3D;

        // Calculate keypoint vectors for torso
        const v_mid_hip = getKPVector(kps, 'mid_hip');
        const v_mid_shoulder = getKPVector(kps, 'mid_shoulder');

        // Spine/Torso
        if (glbBones.Spine && bindDirections.Spine) {
            const targetDir = new T.Vector3().subVectors(v_mid_shoulder, v_mid_hip).normalize();
            rotateBone('Spine', targetDir);
        }

        // Left Arm
        if (glbBones.LeftArm && bindDirections.LeftArm) {
            const targetDir = new T.Vector3().subVectors(getKPVector(kps, 13), getKPVector(kps, 11)).normalize();
            const transformedDir = new T.Vector3(
              targetDir.y,
              targetDir.x,
              targetDir.z
            ).normalize();
            rotateBone('LeftArm', transformedDir);
        }
        
        // Left ForeArm
        if (glbBones.LeftForeArm && bindDirections.LeftForeArm) {
            const targetDir = new T.Vector3().subVectors(getKPVector(kps, 15), getKPVector(kps, 13)).normalize();
            const transformedDir = new T.Vector3(
              targetDir.y,
              targetDir.x,
              targetDir.z
            ).normalize();
            rotateBone('LeftForeArm', transformedDir);
        }
        
        // Right Arm
        if (glbBones.RightArm && bindDirections.RightArm) {
            const targetDir = new T.Vector3().subVectors(
                getKPVector(kps, 14), 
                getKPVector(kps, 12)
            ).normalize();
            const transformedDir = new T.Vector3(
              -targetDir.y,
              -targetDir.x,
              targetDir.z
            ).normalize();
            rotateBone('RightArm', transformedDir);
        }
        
        // Right ForeArm
        if (glbBones.RightForeArm && bindDirections.RightForeArm) {
            const targetDir = new T.Vector3().subVectors(
                getKPVector(kps, 16), 
                getKPVector(kps, 14)
            ).normalize();
            const transformedDir = new T.Vector3(
              -targetDir.y,
              -targetDir.x,
              targetDir.z
            ).normalize();
            rotateBone('RightForeArm', transformedDir);
        }

        // Left Upper Leg (hip to knee)
        if (glbBones.LeftUpLeg && bindDirections.LeftUpLeg) {
            const targetDir = new T.Vector3().subVectors(getKPVector(kps, 24), getKPVector(kps, 26)).normalize();
            const transformedDir = new T.Vector3(
              targetDir.x,
              targetDir.y,
              -targetDir.z
            ).normalize();
            rotateBone('LeftUpLeg', transformedDir);
        }
        
        // Left Lower Leg (knee to ankle)
        if (glbBones.LeftLeg && bindDirections.LeftLeg) {
            const targetDir = new T.Vector3().subVectors(
                getKPVector(kps, 26), 
                getKPVector(kps, 28)
            ).normalize();
            const transformedDir = new T.Vector3(
              targetDir.x,
              -targetDir.y,
              -targetDir.z
            ).normalize();
            rotateBone('LeftLeg', transformedDir);
        }

        // Right Upper Leg
        if (glbBones.RightUpLeg && bindDirections.RightUpLeg) {
            const targetDir = new T.Vector3().subVectors(
                getKPVector(kps, 23), 
                getKPVector(kps, 25)
            ).normalize();
            const transformedDir = new T.Vector3(
              targetDir.x,
              targetDir.y,
              -targetDir.z
            ).normalize();
            rotateBone('RightUpLeg', transformedDir);
        }

        // Right Lower Leg
        if (glbBones.RightLeg && bindDirections.RightLeg) {
            const targetDir = new T.Vector3().subVectors(
                getKPVector(kps, 25), 
                getKPVector(kps, 27)
            ).normalize();
            const transformedDir = new T.Vector3(
              targetDir.x,
              -targetDir.y,
              -targetDir.z
            ).normalize();
            rotateBone('RightLeg', transformedDir);
        }
    } catch (error) {
        console.error('Error in animateModel:', error);
    }
}


// --- END NEW FUNCTIONS ---


// Function to create 3D pose visualization (Original)
// We keep this function so the simple skeleton can still be created
function get3DPose(pose) {
  try {
    if (!pose) {
      console.warn('No pose data available');
      return;
    }
    
    // Check if we have 3D keypoints
    let keypoints = pose.keypoints3D;
    
    // If keypoints3D not available, try to use 2D keypoints with estimated depth
    if (!keypoints || keypoints.length === 0) {
      console.warn('No keypoints3D available, checking for 2D keypoints');
      
      if (!pose.keypoints || pose.keypoints.length === 0) {
        console.warn('No keypoints data available at all');
        return;
      }
      
      // For now, just return if no 3D data - we'll handle 2D fallback separately if needed
      console.warn('Only 2D keypoints available - 3D visualization requires keypoints3D');
      return;
    }
  
  // Create pose geometry if not already initialized
  if (!poseInitialized) {
    // Create new group for this pose
    poseGroup = new T.Group();
    poseGrObject = new GrObject("pose-group", poseGroup);
    
    // Set the pose object's position in the world
    poseGrObject.objects[0].position.set(0, 2.2, 0);
    poseGrObject.objects[0].scale.set(1, 1, 1);
    
    // Hide it if the glbModel is already loaded
    if (glbModel) {
        poseGrObject.objects[0].visible = false;
    }

    world.add(poseGrObject);
    
    // Create spheres for keypoints (33 landmarks)
    for (let i = 0; i < 33; i++) {
      const sphereGeometry = new T.SphereGeometry(0.05, 16, 16);
      const sphereMaterial = new T.MeshStandardMaterial({ 
        color: getKeypointColor(i),
        metalness: 0.3,
        roughness: 0.4
      });
      const sphere = new T.Mesh(sphereGeometry, sphereMaterial);
      sphereMeshes.push(sphere);
    }
    poseGroup.add(...sphereMeshes);
    
    // Create cylinders for connections
    for (const connection of POSE_CONNECTIONS) {
      const cylinderGeometry = new T.CylinderGeometry(0.02, 0.02, 1, 8);
      const cylinderMaterial = new T.MeshStandardMaterial({ color: '#FFFFFF' });
      const cylinder = new T.Mesh(cylinderGeometry, cylinderMaterial);
      cylinderMeshes.push(cylinder);
    }
    poseGroup.add(...cylinderMeshes);
    
    poseInitialized = true;
  }
  
  // Update sphere positions
  for (let i = 0; i < keypoints.length && i < sphereMeshes.length; i++) {
    const keypoint = keypoints[i];
    if (keypoint && keypoint.x !== undefined && keypoint.y !== undefined) {
      // Set 3D coordinates (already provided in keypoints3D)
      // Scale to reasonable 3D size, as positions in keypoints3D are typically normalized to (-1, 1)
      const spherePosition = new T.Vector3(
        -keypoint.x * 3,
        -keypoint.y * 3,
        keypoint.z ? -keypoint.z * 3 : 0
      );   
      // Update sphere position
      sphereMeshes[i].position.copy(spherePosition);
      sphereMeshes[i].visible = true;
    } else {
      sphereMeshes[i].visible = false;
    }
  }
  
  // Update cylinder positions and orientations
  let cylinderIndex = 0;
  for (const connection of POSE_CONNECTIONS) {
    const [startIndex, endIndex] = connection;
    if (keypoints[startIndex] && keypoints[endIndex] && cylinderIndex < cylinderMeshes.length) {
      const startKeypoint = keypoints[startIndex];
      const endKeypoint = keypoints[endIndex];
      
      if (startKeypoint.x !== undefined && startKeypoint.y !== undefined &&
          endKeypoint.x !== undefined && endKeypoint.y !== undefined) {
        
        // Set 3D coordinates (already provided in keypoints3D)
        const start3D = new T.Vector3(
          -startKeypoint.x * 3,
          -startKeypoint.y * 3,
          startKeypoint.z ? -startKeypoint.z * 3 : 0
        );
        
        const end3D = new T.Vector3(
          -endKeypoint.x * 3,
          -endKeypoint.y * 3,
          endKeypoint.z ? -endKeypoint.z * 3 : 0
        );
        
        // Update cylinder
        const cylinder = cylinderMeshes[cylinderIndex];
        const direction = new T.Vector3().subVectors(end3D, start3D);
        const length = direction.length();
        
        if (length > 0.001) {
          // Reset cylinder rotation and scale first
          cylinder.rotation.set(0, 0, 0);
          cylinder.scale.set(1, 1, 1);
          
          // Scale cylinder to match the distance
          cylinder.scale.set(1, length, 1);
          
          // Position cylinder at the midpoint between start and end
          const midpoint = new T.Vector3().addVectors(start3D, end3D).multiplyScalar(0.5);
          cylinder.position.copy(midpoint);
          
          // Orient cylinder to align with the direction vector
          // Create a matrix that aligns the cylinder's Y-axis with the direction
          const up = new T.Vector3(0, 1, 0);
          const quaternion = new T.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
          cylinder.quaternion.copy(quaternion);
          
          cylinder.visible = true;
        } 
      }
      else {
        cylinder.visible = false;
      }
      cylinderIndex++;
    }
  }
  
  // Hide any unused cylinders
  for (let i = cylinderIndex; i < cylinderMeshes.length; i++) {
    cylinderMeshes[i].visible = false;
  }
  
  } catch (error) {
    console.error('Error in get3DPose:', error);
    console.error('Pose data:', pose);
    throw error; // Re-throw to be caught by detectAndDraw error handler
  }
}

// Function to draw pose skeleton (on 2D canvas)
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
      
      // Draw keypoint number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
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
    let poses = [];
    try {
      poses = await detector.estimatePoses(video, estimationConfig);
      if (!poses || !Array.isArray(poses)) {
        poses = [];
      }
    } catch (error) {
      console.error('Error detecting poses on video:', error);
      poses = [];
    }
    
    // Clear previous drawings
    clearCanvas();
    
    // Update debug info
    debug.textContent = `Video: ${video.videoWidth}x${video.videoHeight}\nPoses detected: ${poses.length}\n`;
    
    // Animate the GLB model for the first detected pose
    if (poses.length > 0) {
      const pose = poses[0];
      const confidence = pose.score ? pose.score.toFixed(3) : 'N/A';
      debug.textContent += `Pose 1: confidence ${confidence}\n`;
      
      // Animate the model
      animateModel(pose);
    }
    
  } catch (error) {
    debug.textContent = `Detection error: ${error.message}`;
    console.error(`Detection error: ${error.message}`);
  }
  
  // Continue the detection loop
  requestAnimationFrame(detectAndDraw);
}

// Initialize everything
async function init() {
  try {
    debug.textContent = 'Loading dependencies...';
    console.log('Starting initialization...');
    
    // Wait for TensorFlow.js to be available
    let attempts = 0;
    while (typeof poseDetection === 'undefined' && attempts < 100) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (attempts % 10 === 0) {
        debug.textContent = `Loading dependencies... (${attempts}/100)`;
      }
    }
    
    if (typeof poseDetection === 'undefined') {
      throw new Error('TensorFlow.js pose detection not loaded after 10 seconds');
    }
    
    // Initialize TensorFlow.js backend
    if (typeof tf !== 'undefined' && tf.backend) {
      debug.textContent = 'Initializing TensorFlow.js backend...';
      await tf.ready();
      console.log('TensorFlow.js backend initialized');
    }
    
    debug.textContent = 'Creating detector...';
    console.log('Creating detector with config:', detectorConfig);
    
    detector = await poseDetection.createDetector(model, detectorConfig);
    console.log('Detector created successfully');
    
    // Wait for video to load
    if (video.readyState >= 1) {
      debug.textContent = 'Model loaded. Starting detection...';
      detectAndDraw();
    } else {
      video.addEventListener('loadedmetadata', () => {
        debug.textContent = 'Model loaded. Starting detection...';
        detectAndDraw();
      });
    }
    
  } catch (error) {
    debug.textContent = `Error: ${error.message}`;
    console.error('Initialization error:', error);
    console.error('Error stack:', error.stack);
  }
}

// @@Snippet:makeworld
// Initialize the 3D world
world = new GrWorld({
    groundplanecolor: "gray",
    where: document.getElementById("div1")
});

// Get video and debug elements
video = document.getElementById('video');
canvas = document.getElementById('canvas');
ctx = canvas.getContext('2d');
debug = document.getElementById('debug');

// Add some lighting to better see the pose
const ambientLight = new T.AmbientLight(0x404040, 0.6);
world.add(new GrObject("ambient-light", ambientLight));

const directionalLight = new T.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
world.add(new GrObject("directional-light", directionalLight));

// run the animation/interaction loop
world.go();

// --- NEW: Load the GLB Model ---
const loader = new GLTFLoader();

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !! IMPORTANT: REPLACE WITH THE PATH TO YOUR RIGGED GLB FILE !!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
loader.load("../docs/1/leaf_pokemon.glb", (gltf) => {
    glbModel = gltf.scene;
    
    // Scale and position the model as needed
    glbModel.scale.set(1.5, 1.5, 1.5);
    glbModel.position.set(0, 0, 0); // Start at origin
    glbModel.traverse(child => {
        if(child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    // Find the SkinnedMesh and map the bones (only once)
    let bonesMapped = false;
    glbModel.traverse(child => {
        if (child.isSkinnedMesh && !bonesMapped) {
            console.log("Found SkinnedMesh!");
            // This maps the bones by name for easy access
            mapBones(child);
            bonesMapped = true;
        }
    });

    // Add the model to the world
    let grModel = new GrObject("character", glbModel);
    world.add(grModel);
}, 
// onProgress callback (optional)
(xhr) => {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
}, 
// onError callback
(error) => {
    console.error('An error happened while loading the GLB model:', error);
    debug.textContent = "Error: Could not load GLB model. Check console and file path.";
});
// --- END GLB LOADING ---


// Start pose detection initialization
init();
// @@Snippet:end
// CS559 2025 Workbook
