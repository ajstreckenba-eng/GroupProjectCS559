import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import { AutoUI } from "../libs/CS559-Framework/AutoUI.js";

/*
 * Create your own Cloth simulation in this file!
 */
let world = new GrWorld({ groundplane: false });

class ClothSimulation extends GrObject {
  constructor() {
    const group = new T.Group();

    super("ClothSimulation", group, [
      ["Resolution", 5, 20, 10, 1], // Number of mass points per side
      ["Spring Stiffness", 1, 500, 400, 1], // Higher = stiffer cloth
      ["Timestep", 0.001, 0.1, 0.01, 0.001], // Time step size
      ["Damping", 0.9, 0.999, 0.95, 0.001], // Velocity damping factor
      ["Gravity", -50, 0, -2, 0.1], // Gravity strength
      ["Drag Coefficient", 0, 2, 0.5, 0.1], // Air resistance

      ["Anchor 1 - x", -10, 10, -1.35, 0.1],
      ["Anchor 1 - y", -10, 10, 3, 0.1],
      ["Anchor 1 - z", -10, 10, 0, 0.1],

      ["Anchor 2 - x", -10, 10, 1.35, 0.1],
      ["Anchor 2 - y", -10, 10, 3, 0.1],
      ["Anchor 2 - z", -10, 10, 0, 0.1],

      ["Sphere X", -5, 5, 0, 0.1],
      ["Sphere Y", -5, 5, 1.5, 0.1],
      ["Sphere Z", -5, 5, 1, 0.1],
      ["Sphere Radius", 0.1, 2, 0.5, 0.1],
      ["Collision Stiffness", 1, 1000, 400, 1], // Penalty force stiffness
    ]);

    this.group = group;
    this.mass = 2.0; // Mass of each particle
    this.restLength = 0.3; // Distance between adjacent mass points

    this.resetSimulation();
    this.createVisuals();
  }

  resetSimulation() {
    const res =
      this.values && this.values["Resolution"] !== undefined
        ? this.values["Resolution"]
        : 10;

    this.resolution = res;
    this.masses = [];
    this.springs = [];

    // ===== Create Grid of Mass Points =====
    for (let i = 0; i < res; i++) {
      this.masses[i] = [];
      for (let j = 0; j < res; j++) {
        // j = column (left to right)
        // Calculate position in 3D space
        const x = (j - (res - 1) / 2) * this.restLength; // Center horizontally
        const y = 3 - i * this.restLength; // Top to bottom
        const z = 0; // Start in XY plane

        // Fix the two top corners as anchor points
        const isFixed = i === 0 && (j === 0 || j === res - 1);

        this.masses[i][j] = {
          position: new T.Vector3(x, y, z),
          velocity: new T.Vector3(0, 0, 0),
          fixed: isFixed,
        };

        if (isFixed) {
          console.log(this.masses[i][j].position);
        }
      }
    }

    // ===== Create Structural Springs =====
    // Connect each mass to its immediate neighbors (right and down)
    this.springs = [];
    for (let i = 0; i < res; i++) {
      for (let j = 0; j < res; j++) {
        // Horizontal spring (to the right)
        if (j < res - 1) {
          const mass1 = this.masses[i][j];
          const mass2 = this.masses[i][j + 1];
          const restLength = mass1.position.distanceTo(mass2.position);
          this.springs.push({ i1: i, j1: j, i2: i, j2: j + 1, restLength });
        }
        // Vertical spring (downward)
        if (i < res - 1) {
          const mass1 = this.masses[i][j];
          const mass2 = this.masses[i + 1][j];
          const restLength = mass1.position.distanceTo(mass2.position);
          this.springs.push({ i1: i, j1: j, i2: i + 1, j2: j, restLength });
        }
        // Lower-left diagonal spring.
        if (j < res - 1 && i < res - 1) {
          const mass1 = this.masses[i][j];
          const mass2 = this.masses[i + 1][j + 1];
          const restLength = mass1.position.distanceTo(mass2.position);
          this.springs.push({ i1: i, j1: j, i2: i + 1, j2: j + 1, restLength });
        }
        // Lower-right diagonal spring.
        if (i < res - 1 && j >= 1) {
          const mass1 = this.masses[i][j];
          const mass2 = this.masses[i + 1][j - 1];
          const restLength = mass1.position.distanceTo(mass2.position);
          this.springs.push({ i1: i, j1: j, i2: i + 1, j2: j - 1, restLength });
        }
      }
    }

    if (this.masspoints) {
      this.clearVisuals();
      this.createVisuals();
    }
  }

  clearVisuals() {
    if (this.clothMesh) {
      this.group.remove(this.clothMesh);
    }
    if (this.masspoints) {
      this.masspoints.forEach((row) => {
        row.forEach((masspoint) => {
          if (masspoint) {
            this.group.remove(masspoint);
          }
        });
      });
    }
    if (this.collisionSphere) {
      this.group.remove(this.collisionSphere);
    }
  }

  createVisuals() {
    this.masspoints = [];

    // Create cloth mesh geometry with triangular faces
    const geometry = new T.BufferGeometry();

    // Create vertices array
    const vertices = [];
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const mass = this.masses[i][j];
        vertices.push(mass.position.x, mass.position.y, mass.position.z);
      }
    }

    // Create triangular faces (two triangles per grid square)
    const indices = [];
    for (let i = 0; i < this.resolution - 1; i++) {
      for (let j = 0; j < this.resolution - 1; j++) {
        const topLeft = i * this.resolution + j;
        const topRight = topLeft + 1;
        const bottomLeft = (i + 1) * this.resolution + j;
        const bottomRight = bottomLeft + 1;

        // First triangle (top-left, bottom-left, top-right)
        indices.push(topLeft, bottomLeft, topRight);

        // Second triangle (top-right, bottom-left, bottom-right)
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Create material with double-sided rendering
    const material = new T.MeshPhongMaterial({
      color: 0x4488ff,
      side: T.DoubleSide,
      flatShading: false,
    });

    this.clothMesh = new T.Mesh(geometry, material);
    this.group.add(this.clothMesh);

    // Optionally add small spheres for fixed points
    for (let i = 0; i < this.resolution; i++) {
      this.masspoints[i] = [];
      for (let j = 0; j < this.resolution; j++) {
        const mass = this.masses[i][j];
        if (mass.fixed) {
          const sphereGeometry = new T.SphereGeometry(0.03, 8, 8);
          const sphereMaterial = new T.MeshPhongMaterial({ color: 0xff0000 });
          const masspoint = new T.Mesh(sphereGeometry, sphereMaterial);
          masspoint.position.copy(mass.position);
          this.masspoints[i][j] = masspoint;
          this.group.add(masspoint);
        } else {
          this.masspoints[i][j] = null;
        }
      }
    }

    // Create collision sphere
    const sphereRadius =
      this.values && this.values["Sphere Radius"] !== undefined
        ? this.values["Sphere Radius"]
        : 0.5;
    const sphereGeometry = new T.SphereGeometry(sphereRadius, 32, 32);
    const sphereMaterial = new T.MeshPhongMaterial({
      color: 0xff9900,
      transparent: true,
      opacity: 0.7,
    });
    this.collisionSphere = new T.Mesh(sphereGeometry, sphereMaterial);

    const sphereX =
      this.values && this.values["Sphere X"] !== undefined
        ? this.values["Sphere X"]
        : 0;
    const sphereY =
      this.values && this.values["Sphere Y"] !== undefined
        ? this.values["Sphere Y"]
        : 1.5;
    const sphereZ =
      this.values && this.values["Sphere Z"] !== undefined
        ? this.values["Sphere Z"]
        : 0;

    this.collisionSphere.position.set(sphereX, sphereY, sphereZ);
    this.group.add(this.collisionSphere);
  }

  /**
   * Update the cloth simulation
   * Same physics as before, but now scaled to a full grid!
   */
  stepWorld() {
    const springConstant =
      this.values && this.values["Spring Stiffness"] !== undefined
        ? this.values["Spring Stiffness"]
        : 50;
    const timestep =
      this.values && this.values["Timestep"] !== undefined
        ? this.values["Timestep"]
        : 0.01;
    const damping =
      this.values && this.values["Damping"] !== undefined
        ? this.values["Damping"]
        : 0.95;
    const gravityY =
      this.values && this.values["Gravity"] !== undefined
        ? this.values["Gravity"]
        : -2;
    const dragCoefficient =
      this.values && this.values["Drag Coefficient"] !== undefined
        ? this.values["Drag Coefficient"]
        : 0.5;
    const newRes =
      this.values && this.values["Resolution"] !== undefined
        ? this.values["Resolution"]
        : 10;

    // Check if resolution changed - if so, rebuild the cloth
    if (newRes !== this.resolution) {
      this.resetSimulation();
      return;
    }

    this.masses[0][0].position = new T.Vector3(
      this.values["Anchor 1 - x"],
      this.values["Anchor 1 - y"],
      this.values["Anchor 1 - z"],
    );
    this.masses[0][newRes - 1].position = new T.Vector3(
      this.values["Anchor 2 - x"],
      this.values["Anchor 2 - y"],
      this.values["Anchor 2 - z"],
    );

    const dt = timestep;

    // ===== Update Every Mass Point in the Grid =====
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const mass = this.masses[i][j];
        if (!mass.fixed) {
          // Start with gravity
          const totalForce = new T.Vector3(0, gravityY * this.mass, 0);

          // Accumulate forces from all connected springs
          // Note: Each interior mass point is connected to 4 springs!
          this.springs.forEach((spring) => {
            if (
              (spring.i1 === i && spring.j1 === j) ||
              (spring.i2 === i && spring.j2 === j)
            ) {
              const otherI =
                spring.i1 === i && spring.j1 === j ? spring.i2 : spring.i1;
              const otherJ =
                spring.i1 === i && spring.j1 === j ? spring.j2 : spring.j1;
              const otherMass = this.masses[otherI][otherJ];

              // Hooke's Law
              const displacement = new T.Vector3().subVectors(
                mass.position,
                otherMass.position,
              );
              const currentLength = displacement.length();

              if (currentLength > 0) {
                const extension = currentLength - spring.restLength;
                const springDirection = displacement.clone().normalize();
                const springForce = springDirection
                  .clone()
                  .multiplyScalar(-springConstant * extension);
                totalForce.add(springForce);
              }
            }
          });

          const dragForce = mass.velocity
            .clone()
            .multiplyScalar(-dragCoefficient);
          totalForce.add(dragForce);

          const sphereRadius =
            this.values && this.values["Sphere Radius"] !== undefined
              ? this.values["Sphere Radius"]
              : 0.5;
          const sphereX =
            this.values && this.values["Sphere X"] !== undefined
              ? this.values["Sphere X"]
              : 0;
          const sphereY =
            this.values && this.values["Sphere Y"] !== undefined
              ? this.values["Sphere Y"]
              : 1.5;
          const sphereZ =
            this.values && this.values["Sphere Z"] !== undefined
              ? this.values["Sphere Z"]
              : 0;
          const collisionStiffness =
            this.values && this.values["Collision Stiffness"] !== undefined
              ? this.values["Collision Stiffness"]
              : 200;

          const sphereCenter = new T.Vector3(sphereX, sphereY, sphereZ);
          const toMass = new T.Vector3().subVectors(
            mass.position,
            sphereCenter,
          );
          const distanceToCenter = toMass.length();

          if (distanceToCenter < sphereRadius) {
            const penetrationDepth = sphereRadius - distanceToCenter;

            const normal =
              distanceToCenter > 0
                ? toMass.clone().normalize()
                : new T.Vector3(0, 1, 0);

            const penaltyForce = normal
              .clone()
              .multiplyScalar(collisionStiffness * penetrationDepth);
            totalForce.add(penaltyForce);
          }

          const acceleration = totalForce.clone().divideScalar(this.mass);

          const dampingForce = mass.velocity
            .clone()
            .multiplyScalar((-(1 - damping) * this.mass) / dt);
          const dampedAcceleration = acceleration
            .clone()
            .add(dampingForce.divideScalar(this.mass));

          mass.velocity.add(dampedAcceleration.clone().multiplyScalar(dt));
          mass.position.add(mass.velocity.clone().multiplyScalar(dt));

          // Stability check
          if (
            isNaN(mass.position.x) ||
            isNaN(mass.position.y) ||
            isNaN(mass.position.z) ||
            isNaN(mass.velocity.x) ||
            isNaN(mass.velocity.y) ||
            isNaN(mass.velocity.z) ||
            mass.position.length() > 1000 ||
            mass.velocity.length() > 1000
          ) {
            console.log(
              "NaN value detected! Try reducing timestep, stiffness, or increasing damping.",
            );
            return;
          }
        }
      }
    }

    // ===== Update Visual Representation =====
    // Update cloth mesh vertices
    const positions = this.clothMesh.geometry.attributes.position.array;
    let vertexIndex = 0;
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const mass = this.masses[i][j];
        positions[vertexIndex++] = mass.position.x;
        positions[vertexIndex++] = mass.position.y;
        positions[vertexIndex++] = mass.position.z;
      }
    }
    this.clothMesh.geometry.attributes.position.needsUpdate = true;
    this.clothMesh.geometry.computeVertexNormals(); // Recalculate normals for proper lighting

    // Update fixed point spheres
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        if (this.masspoints[i][j]) {
          this.masspoints[i][j].position.copy(this.masses[i][j].position);
        }
      }
    }

    // Update collision sphere position and size
    const sphereRadius =
      this.values && this.values["Sphere Radius"] !== undefined
        ? this.values["Sphere Radius"]
        : 0.5;
    const sphereX =
      this.values && this.values["Sphere X"] !== undefined
        ? this.values["Sphere X"]
        : 0;
    const sphereY =
      this.values && this.values["Sphere Y"] !== undefined
        ? this.values["Sphere Y"]
        : 1.5;
    const sphereZ =
      this.values && this.values["Sphere Z"] !== undefined
        ? this.values["Sphere Z"]
        : 0;

    this.collisionSphere.position.set(sphereX, sphereY, sphereZ);
    this.collisionSphere.scale.setScalar(
      sphereRadius / (this.collisionSphere.geometry.parameters.radius || 0.5),
    );
  }
}

world.scene.add(new T.AmbientLight(0x404040, 0.4));
const directionalLight = new T.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
world.scene.add(directionalLight);

const clothSimulation = new ClothSimulation();
world.add(clothSimulation);

new AutoUI(clothSimulation, 200);

const resetButton = document.createElement("button");
resetButton.innerHTML = "Reset Simulation";
resetButton.style.padding = "10px 20px";
resetButton.style.fontSize = "14px";
resetButton.style.backgroundColor = "#4CAF50";
resetButton.style.color = "white";
resetButton.style.border = "none";
resetButton.style.borderRadius = "4px";
resetButton.style.cursor = "pointer";
resetButton.style.margin = "10px";

resetButton.addEventListener("click", function () {
  clothSimulation.resetSimulation();
});

document.body.appendChild(resetButton);

world.camera.position.set(4, 4, 4);
world.camera.lookAt(0, 2, 0);

world.go();
// CS559 2025 Workbook
