/* loader.js */
import { GLTFLoader } from "../libs/CS559-Three/examples/jsm/loaders/GLTFLoader.js";
import * as T from "../libs/CS559-Three/build/three.module.js";

const gltfLoader = new GLTFLoader();
const textureLoader = new T.TextureLoader();

// Simple cache object (replacing the Cache class from the snippet)
const cache = {}; 

/**
 * Loads a 3D Model (GLTF/GLB) with caching.
 * @param {string} path - URL to the model file
 * @returns {Promise<Object>} - The loaded scene and animations
 */
export const load3DModel = (path) => {
  // 1. Check Cache: If we already have it, return it immediately
  if (cache[path]) {
    return Promise.resolve(cache[path]);
  }

  // 2. Load New: If not, download it
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const data = {
          scene: gltf.scene,
          animations: gltf.animations
        };
        
        // Save to cache for next time
        cache[path] = data; 
        
        resolve(data);
      },
      undefined, // onProgress
      (error) => {
        console.error(`Error loading model ${path}:`, error);
        reject(error);
      }
    );
  });
};