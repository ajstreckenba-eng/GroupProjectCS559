import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import { AutoUI } from "../libs/CS559-Framework/AutoUI.js";

/**
 * Cloth Simulation with Grid Structure
 *
 * This example scales up from 4 masses to a FULL GRID of masses.
 */
class ClothSimulation extends GrObject {
    constructor() {
        const group = new T.Group();

        super("ClothSimulation", group, [
            ["Resolution", 5, 20, 10, 1],           // Number of mass points per side
            ["Spring Stiffness", 1, 500, 50, 1],    // Higher = stiffer cloth
            ["Timestep", 0.001, 0.1, 0.01, 0.001],  // Time step size
            ["Damping", 0.90, 0.999, 0.95, 0.001],  // Velocity damping factor
            ["Gravity", -50, 0, -2, 0.1]            // Gravity strength
        ]);

        this.group = group;
        this.mass = 1.0;            // Mass of each particle
        this.restLength = 0.3;      // Distance between adjacent mass points

        this.resetSimulation();
        this.createVisuals();
    }

    resetSimulation() {
        const res = (this.values && this.values["Resolution"] !== undefined) ? this.values["Resolution"] : 10;

        this.resolution = res;
        this.masses = [];
        this.springs = [];

        // ===== Create Grid of Mass Points =====
        // We use a 2D array structure: masses[row][col]
        // This makes it easy to access neighbors
        for (let i = 0; i < res; i++) {             // i = row (top to bottom)
            this.masses[i] = [];
            for (let j = 0; j < res; j++) {         // j = column (left to right)
                // Calculate position in 3D space
                const x = (j - (res - 1) / 2) * this.restLength;  // Center horizontally
                const y = 3 - (i * this.restLength);               // Top to bottom
                const z = 0;                                        // Start in XY plane

                // Fix the two top corners as anchor points
                const isFixed = (i === 0 && (j === 0 || j === res - 1));

                this.masses[i][j] = {
                    position: new T.Vector3(x, y, z),
                    velocity: new T.Vector3(0, 0, 0),
                    fixed: isFixed
                };
            }
        }

        // ===== Create Structural Springs =====
        // Connect each mass to its immediate neighbors (right and down)
        this.springs = [];
        for (let i = 0; i < res; i++) {
            for (let j = 0; j < res; j++) {
                // Horizontal spring (to the right neighbor)
                if (j < res - 1) {
                    this.springs.push({ i1: i, j1: j, i2: i, j2: j + 1 });
                }
                // Vertical spring (to the bottom neighbor)
                if (i < res - 1) {
                    this.springs.push({ i1: i, j1: j, i2: i + 1, j2: j });
                }
            }
        }

        console.log("Cloth simulation reset with resolution:", res);
        console.log("Total mass points:", res * res);
        console.log("Total springs:", this.springs.length);

        if (this.masspoints) {
            this.clearVisuals();
            this.createVisuals();
        }
    }

    clearVisuals() {
        if (this.masspoints) {
            this.masspoints.forEach(row => {
                row.forEach(masspoint => {
                    this.group.remove(masspoint);
                });
            });
        }
        if (this.springLines) {
            this.springLines.forEach(line => {
                this.group.remove(line);
            });
        }
    }

    createVisuals() {
        this.masspoints = [];
        this.springLines = [];

        for (let i = 0; i < this.resolution; i++) {
            this.masspoints[i] = [];
            for (let j = 0; j < this.resolution; j++) {
                const mass = this.masses[i][j];
                const sphereGeometry = new T.SphereGeometry(0.02, 8, 8);
                const color = mass.fixed ? 0x666666 : 0xff4444;
                const sphereMaterial = new T.MeshPhongMaterial({ color: color });
                const masspoint = new T.Mesh(sphereGeometry, sphereMaterial);
                masspoint.position.copy(mass.position);
                this.masspoints[i][j] = masspoint;
                this.group.add(masspoint);
            }
        }

        this.springs.forEach(spring => {
            const lineGeometry = new T.BufferGeometry();
            const mass1 = this.masses[spring.i1][spring.j1];
            const mass2 = this.masses[spring.i2][spring.j2];
            const positions = new Float32Array([
                mass1.position.x, mass1.position.y, mass1.position.z,
                mass2.position.x, mass2.position.y, mass2.position.z
            ]);
            lineGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
            const lineMaterial = new T.LineBasicMaterial({ color: 0x888888, linewidth: 1 });
            const springLine = new T.Line(lineGeometry, lineMaterial);
            this.springLines.push(springLine);
            this.group.add(springLine);
        });
    }

    /**
     * Update the cloth simulation
     * Same physics as before, but now scaled to a full grid!
     */
    stepWorld() {
        const springConstant = (this.values && this.values["Spring Stiffness"] !== undefined) ? this.values["Spring Stiffness"] : 50;
        const timestep = (this.values && this.values["Timestep"] !== undefined) ? this.values["Timestep"] : 0.01;
        const damping = (this.values && this.values["Damping"] !== undefined) ? this.values["Damping"] : 0.95;
        const gravityY = (this.values && this.values["Gravity"] !== undefined) ? this.values["Gravity"] : -2;
        const newRes = (this.values && this.values["Resolution"] !== undefined) ? this.values["Resolution"] : 10;

        // Check if resolution changed - if so, rebuild the cloth
        if (newRes !== this.resolution) {
            this.resetSimulation();
            return;
        }

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
                    this.springs.forEach(spring => {
                        if ((spring.i1 === i && spring.j1 === j) || (spring.i2 === i && spring.j2 === j)) {
                            const otherI = spring.i1 === i && spring.j1 === j ? spring.i2 : spring.i1;
                            const otherJ = spring.i1 === i && spring.j1 === j ? spring.j2 : spring.j1;
                            const otherMass = this.masses[otherI][otherJ];

                            // Hooke's Law
                            const displacement = new T.Vector3().subVectors(mass.position, otherMass.position);
                            const currentLength = displacement.length();

                            if (currentLength > 0) {
                                const extension = currentLength - this.restLength;
                                const springDirection = displacement.clone().normalize();
                                const springForce = springDirection.clone().multiplyScalar(-springConstant * extension);
                                totalForce.add(springForce);
                            }
                        }
                    });

                    // ===== Explicit Euler Integration =====
                    const acceleration = totalForce.clone().divideScalar(this.mass);
                    mass.position.add(mass.velocity.clone().multiplyScalar(dt));
                    mass.velocity.add(acceleration.clone().multiplyScalar(dt));

                    // ===== Non-Physical Damping =====
                    // This is NOT realistic! It just multiplies velocity by a factor < 1
                    // It helps stability but makes the cloth look "dead" if too strong
                    mass.velocity.multiplyScalar(damping);

                    // Stability check
                    if (isNaN(mass.position.x) || isNaN(mass.position.y) || isNaN(mass.position.z) ||
                        isNaN(mass.velocity.x) || isNaN(mass.velocity.y) || isNaN(mass.velocity.z) ||
                        mass.position.length() > 1000 || mass.velocity.length() > 1000) {
                        console.log("NaN value detected! Try reducing timestep, stiffness, or increasing damping.");
                        return;
                    }
                }
            }
        }

        // ===== Update Visual Representation =====
        // Update all mass point spheres
        for (let i = 0; i < this.resolution; i++) {
            for (let j = 0; j < this.resolution; j++) {
                this.masspoints[i][j].position.copy(this.masses[i][j].position);
            }
        }

        // Update all spring lines
        this.springs.forEach((spring, idx) => {
            const positions = this.springLines[idx].geometry.attributes.position.array;
            const mass1 = this.masses[spring.i1][spring.j1];
            const mass2 = this.masses[spring.i2][spring.j2];
            positions[0] = mass1.position.x;
            positions[1] = mass1.position.y;
            positions[2] = mass1.position.z;
            positions[3] = mass2.position.x;
            positions[4] = mass2.position.y;
            positions[5] = mass2.position.z;
            this.springLines[idx].geometry.attributes.position.needsUpdate = true;
        });
    }
}

let world = new GrWorld({groundplane: false, where: document.getElementById("div1")});

world.scene.add(new T.AmbientLight(0x404040, 0.4));
const directionalLight = new T.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
world.scene.add(directionalLight);

const clothSimulation = new ClothSimulation();
world.add(clothSimulation);

new AutoUI(clothSimulation);

const resetButton = document.createElement('button');
resetButton.innerHTML = 'Reset Simulation';
resetButton.style.padding = '10px 20px';
resetButton.style.fontSize = '14px';
resetButton.style.backgroundColor = '#4CAF50';
resetButton.style.color = 'white';
resetButton.style.border = 'none';
resetButton.style.borderRadius = '4px';
resetButton.style.cursor = 'pointer';
resetButton.style.margin = '10px';

resetButton.addEventListener('click', function() {
    clothSimulation.resetSimulation();
});

document.body.appendChild(resetButton);

world.camera.position.set(4, 4, 4);
world.camera.lookAt(0, 2, 0);

world.go();
// CS559 2025 Workbook
