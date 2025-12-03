import * as T from "../libs/CS559-Three/build/three.module.js";

const directionalLightColor = new T.Vector3(1.8, 1.7, 1.6).multiplyScalar(0.8);
const ambientLight = new T.Vector3(0.2, 0.2, 0.2);
const directionalLightDir = new T.Vector3(0.7, 0.5, 0.3).normalize();

export function createArtDecoMaterial(fogParams = {}) {
  const fogColor = fogParams.color || new T.Color(0xffffff);
  const fogNear = fogParams.near !== undefined ? fogParams.near : 0;
  const fogFar = fogParams.far !== undefined ? fogParams.far : 8;

  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vUv = uv;
      vNormal = normalMatrix * normal;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform vec3 ambientLight;
    uniform vec3 directionalLightDir;
    uniform vec3 directionalLightColor;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    // Antialiased stripe pattern
    vec2 integral(vec2 x, vec2 width) {
        vec2 h = fract(x * 0.5) - vec2(0.5);
        return (vec2(1.0) - 2.0 * abs(h)) / width;
    }

    float smooth_lines(vec2 uv, vec2 width) {
        vec2 a = uv - width / 2.0;
        vec2 b = uv + width / 2.0;
        vec2 integral = integral(a, width) - integral(b, width);
        return 0.5 - 0.5 * integral.x;
    }

    void main() {
      // Calculate stripe pattern
      vec2 scaled = vUv * 5.0;
      float stripePattern = smooth_lines(scaled, fwidth(scaled));

      // Dark stone color for background
      vec3 darkStone = vec3(0.16, 0.38, 0.44);
      // Gold/brass color for stripes
      vec3 goldColor = vec3(0.75, 0.56, 0.294);

      // Different shininess for stripes vs stone
      float stripeShininess = 8.0;  // Shiny stripes
      float stoneShininess = 4.0;    // Matte stone

      // Mix materials based on stripe pattern
      vec3 diffuseColor = mix(goldColor, darkStone, stripePattern);
      float shininess = mix(stripeShininess, stoneShininess, stripePattern);

      // Normalize the normal
      vec3 N = normalize(vNormal);

      // Ambient component
      vec3 ambient = ambientLight * diffuseColor;

      // Directional light - diffuse component
      vec3 L = normalize(directionalLightDir);
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = directionalLightColor * diffuseColor * NdotL;

      // Specular component (Blinn-Phong)
      vec3 V = normalize(vViewPosition);
      vec3 H = normalize(L + V);
      float NdotH = max(dot(N, H), 0.0);
      float specularStrength = pow(NdotH, shininess);

      // Specular color (white for stripes, darker for stone)
      vec3 specularColor = mix(vec3(1.0), vec3(0.1), stripePattern);
      vec3 specular = directionalLightColor * specularColor * specularStrength * 0.5;

      // Combine lighting
      vec3 color = ambient + diffuse + specular;

      gl_FragColor = vec4(color, 1.0);

      // Height-based fog calculation
      float fogHeight = vWorldPosition.y;
      float fogFactor = smoothstep(fogNear, fogFar, fogHeight);
      gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, fogFactor);
    }
  `;

  const uniforms = {
    fogColor: { value: fogColor },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar },
    ambientLight: { value: ambientLight },
    directionalLightDir: { value: directionalLightDir },
    directionalLightColor: { value: directionalLightColor },
  };

  return new T.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
  });
}

export function createBronzeMaterial(fogParams = {}) {
  const fogColor = fogParams.color || new T.Color(0xffffff);
  const fogNear = fogParams.near !== undefined ? fogParams.near : 0;
  const fogFar = fogParams.far !== undefined ? fogParams.far : 10;

  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalMatrix * normal;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform vec3 ambientLight;
    uniform vec3 directionalLightDir;
    uniform vec3 directionalLightColor;
    uniform vec3 bronzeColor;
    uniform float shininess;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      // Normalize the normal
      vec3 N = normalize(vNormal);

      // Ambient component
      vec3 ambient = ambientLight * bronzeColor;

      // Directional light - diffuse component
      vec3 L = normalize(directionalLightDir);
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = directionalLightColor * bronzeColor * NdotL;

      // Specular component (Blinn-Phong)
      vec3 V = normalize(vViewPosition);
      vec3 H = normalize(L + V);
      float NdotH = max(dot(N, H), 0.0);
      float specularStrength = pow(NdotH, shininess);

      // Bronze has a warm specular highlight
      vec3 specularColor = vec3(0.9, 0.8, 0.6);
      vec3 specular = directionalLightColor * specularColor * specularStrength * 0.6;

      // Combine lighting
      vec3 color = ambient + diffuse + specular;

      gl_FragColor = vec4(color, 1.0);

      // Height-based fog calculation
      float fogHeight = vWorldPosition.y;
      float fogFactor = smoothstep(fogNear, fogFar, fogHeight);
      gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, fogFactor);
    }
  `;

  const uniforms = {
    fogColor: { value: fogColor },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar },
    ambientLight: { value: ambientLight },
    directionalLightDir: { value: directionalLightDir },
    directionalLightColor: { value: directionalLightColor },
    bronzeColor: { value: new T.Color(0.55, 0.42, 0.25) },
    shininess: { value: 8.0 },
  };

  return new T.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
  });
}

export function createBuildingMaterialWithWindows(
  fogParams = {},
  isNightMode = false,
) {
  const fogColor = fogParams.color || new T.Color(0xffffff);
  const fogNear = fogParams.near !== undefined ? fogParams.near : 0;
  const fogFar = fogParams.far !== undefined ? fogParams.far : 10;

  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vNormal = normalMatrix * normal;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform vec3 ambientLight;
    uniform vec3 directionalLightDir;
    uniform vec3 directionalLightColor;
    uniform vec3 buildingColor;
    uniform float shininess;
    uniform bool isNightMode;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;

    // Random function for light variation
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
      // Create window pattern
      vec2 windowUV = fract(vUv * vec2(4.0, 12.0)); // 4 windows wide, 12 floors tall

      // Window vs wall determination
      bool isWindow = (windowUV.x > 0.15 && windowUV.x < 0.85 && windowUV.y > 0.1 && windowUV.y < 0.9);

      // Balcony determination (every 3rd floor, during day mode)
      float floorNum = floor(vUv.y * 12.0);
      bool isBalconyFloor = mod(floorNum, 3.0) == 0.0 && !isNightMode;
      // Balcony at bottom of floor (bigger and more visible)
      bool isBalcony = isBalconyFloor && windowUV.y < 0.25 && windowUV.x > 0.15 && windowUV.x < 0.85;

      // Cheering person on balcony (bigger and more visible)
      float personId = floor(vUv.x * 4.0) + floor(vUv.y * 12.0) * 4.0;
      bool hasPerson = random(vec2(personId, 1.0)) > 0.6 && isBalconyFloor;
      // Person positioned ON the balcony (bigger size)
      bool isPerson = hasPerson && windowUV.y > 0.05 && windowUV.y < 0.25 && windowUV.x > 0.35 && windowUV.x < 0.65 && !isNightMode;

      // Random light on/off for each window
      float windowId = floor(vUv.x * 4.0) + floor(vUv.y * 12.0) * 4.0;
      float lightOn = random(vec2(windowId, 0.0));
      bool windowLit = lightOn > 0.3; // 70% of windows are lit

      // Base building color (cream stone)
      vec3 wallColor = buildingColor;

      // Balcony color (darker, like concrete - more prominent)
      vec3 balconyColor = vec3(0.35, 0.35, 0.4);

      // Person color (bright, colorful clothing - highly visible)
      vec3 personColor = vec3(1.0, 0.2, 0.1); // Bright red/orange shirt

      // Window colors
      vec3 windowColor;
      if (isNightMode && windowLit) {
        // Warm yellow/orange light at night
        windowColor = vec3(1.0, 0.9, 0.6) * 1.5;
      } else {
        // Dark blue/black glass during day or when lights are off
        windowColor = vec3(0.1, 0.15, 0.2);
      }

      // Mix between wall, window, balcony, and person
      vec3 baseColor = wallColor;
      if (isPerson) {
        baseColor = personColor;
      } else if (isBalcony) {
        baseColor = balconyColor;
      } else if (isWindow) {
        baseColor = windowColor;
      }

      // Normalize the normal
      vec3 N = normalize(vNormal);

      // Ambient component
      vec3 ambient = ambientLight * baseColor;

      // Directional light - diffuse component (less effect on lit windows)
      vec3 L = normalize(directionalLightDir);
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = directionalLightColor * baseColor * NdotL;

      // Windows emit light at night
      if (isWindow && isNightMode && windowLit) {
        diffuse = baseColor; // Emissive windows
        ambient = baseColor * 0.5;
      }

      // People on balconies are bright and visible (emissive)
      if (isPerson) {
        diffuse = baseColor * 1.5; // Boost brightness
        ambient = baseColor * 0.8;  // High ambient so they're visible from all angles
      }

      // Specular component (Blinn-Phong) - minimal for windows
      vec3 V = normalize(vViewPosition);
      vec3 H = normalize(L + V);
      float NdotH = max(dot(N, H), 0.0);
      float specularStrength = pow(NdotH, shininess);

      vec3 specular = vec3(0.0);
      if (!isWindow) {
        specular = directionalLightColor * vec3(1.0) * specularStrength * 0.1;
      }

      // Combine lighting
      vec3 color = ambient + diffuse + specular;

      gl_FragColor = vec4(color, 1.0);

      // Height-based fog calculation
      float fogHeight = vWorldPosition.y;
      float fogFactor = smoothstep(fogNear, fogFar, fogHeight);
      gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, fogFactor);
    }
  `;

  const uniforms = {
    fogColor: { value: fogColor },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar },
    ambientLight: { value: ambientLight },
    directionalLightDir: { value: directionalLightDir },
    directionalLightColor: { value: directionalLightColor },
    buildingColor: { value: new T.Color(0.811, 0.745, 0.64) },
    shininess: { value: 8.0 },
    isNightMode: { value: isNightMode },
  };

  return new T.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
  });
}

export function createCreamStoneMaterial(fogParams = {}) {
  const fogColor = fogParams.color || new T.Color(0xffffff);
  const fogNear = fogParams.near !== undefined ? fogParams.near : 0;
  const fogFar = fogParams.far !== undefined ? fogParams.far : 10;

  const vertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalMatrix * normal;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 fogColor;
    uniform float fogNear;
    uniform float fogFar;
    uniform vec3 ambientLight;
    uniform vec3 directionalLightDir;
    uniform vec3 directionalLightColor;
    uniform vec3 stoneColor;
    uniform float shininess;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      // Normalize the normal
      vec3 N = normalize(vNormal);

      // Ambient component
      vec3 ambient = ambientLight * stoneColor;

      // Directional light - diffuse component
      vec3 L = normalize(directionalLightDir);
      float NdotL = max(dot(N, L), 0.0);
      vec3 diffuse = directionalLightColor * stoneColor * NdotL;

      // Specular component (Blinn-Phong) - very subtle for stone
      vec3 V = normalize(vViewPosition);
      vec3 H = normalize(L + V);
      float NdotH = max(dot(N, H), 0.0);
      float specularStrength = pow(NdotH, shininess);

      // Stone has minimal specular
      vec3 specular = directionalLightColor * vec3(1.0) * specularStrength * 0.1;

      // Combine lighting
      vec3 color = ambient + diffuse + specular;

      gl_FragColor = vec4(color, 1.0);

      // Height-based fog calculation
      float fogHeight = vWorldPosition.y;
      float fogFactor = smoothstep(fogNear, fogFar, fogHeight);
      gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, fogFactor);
    }
  `;

  const uniforms = {
    fogColor: { value: fogColor },
    fogNear: { value: fogNear },
    fogFar: { value: fogFar },
    ambientLight: { value: ambientLight },
    directionalLightDir: { value: directionalLightDir },
    directionalLightColor: { value: directionalLightColor },
    stoneColor: { value: new T.Color(0.811, 0.745, 0.64) },
    shininess: { value: 8.0 },
  };

  return new T.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
  });
}
