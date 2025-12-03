import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import { AutoUI } from "../libs/CS559-Framework/AutoUI.js";

/**
 * Rectangular Mass-Spring System
 *
 * This example extends the single spring to FOUR mass points connected in a network.
 */
class RectangularMassSpringSystem extends GrObject {
    constructor() {
        const group = new T.Group();

        super("RectangularMassSpringSystem", group, [
            ["Spring Stiffness", 1, 500, 20, 1],
            ["Timestep", 0.001, 1.0, 0.02, 0.001],
            ["Damping", 0.90, 0.999, 0.98, 0.001],
            ["Gravity", -50, 0, -9.8, 0.1]
        ]);

        this.group = group;
        this.mass = 1.0;                    // Mass of each particle
        this.restLength = 1.5;              // Natural length of each spring

        this.resetSimulation();
        this.createVisuals();
    }

    /**
     * Reset the simulation to its initial state
     * This is called when the user clicks the reset button or when the simulation becomes unstable
     */
    resetSimulation() {
        // Define four mass points arranged in a rectangle:
        //
        //    0 (fixed) ----------- 1 (fixed)
        //       |                     |
        //       |                     |
        //       |                     |
        //    2 (free)  ----------- 3 (free)
        //
        // Mass 0 (top-left) and Mass 1 (top-right) are fixed anchor points
        // Mass 2 (bottom-left) and Mass 3 (bottom-right) hang freely

        this.masses = [
            { position: new T.Vector3(-1, 2, 0), velocity: new T.Vector3(0, 0, 0), fixed: true },   // Top-left (anchor)
            { position: new T.Vector3(1, 2, 0), velocity: new T.Vector3(0, 0, 0), fixed: true },    // Top-right (anchor)
            { position: new T.Vector3(-1, 0.5, 0), velocity: new T.Vector3(0, 0, 0), fixed: false }, // Bottom-left (free)
            { position: new T.Vector3(1, 0.5, 0), velocity: new T.Vector3(0, 0, 0), fixed: false }  // Bottom-right (free)
        ];

        // Define springs connecting the masses (by index):
        // Spring 0: Top edge (0 ↔ 1)
        // Spring 1: Left edge (0 ↔ 2)
        // Spring 2: Right edge (1 ↔ 3)
        // Spring 3: Bottom edge (2 ↔ 3)
        // This forms a rectangular network
        this.springs = [
            { mass1: 0, mass2: 1 },   // Top horizontal spring
            { mass1: 0, mass2: 2 },   // Left vertical spring
            { mass1: 1, mass2: 3 },   // Right vertical spring
            { mass1: 2, mass2: 3 }    // Bottom horizontal spring
        ];

        // If visuals already exist, update them to match the reset physics state
        if (this.masspoints) {
            this.masses.forEach((mass, i) => {
                this.masspoints[i].position.copy(mass.position);
            });

            this.springs.forEach((spring, i) => {
                const positions = this.springLines[i].geometry.attributes.position.array;
                const mass1Pos = this.masses[spring.mass1].position;
                const mass2Pos = this.masses[spring.mass2].position;
                positions[0] = mass1Pos.x;
                positions[1] = mass1Pos.y;
                positions[2] = mass1Pos.z;
                positions[3] = mass2Pos.x;
                positions[4] = mass2Pos.y;
                positions[5] = mass2Pos.z;
                this.springLines[i].geometry.attributes.position.needsUpdate = true;
            });
        }
    }

    /**
     * Create visual representations for the simulation
     * We need two types of visuals:
     * 1. Spheres for the mass points
     * 2. Lines for the springs
     */
    createVisuals() {
        this.masspoints = [];
        this.springLines = [];

        // ===== Create mass point spheres =====
        // Each mass gets a sphere visual
        // Fixed masses are gray, free masses are red
        this.masses.forEach((mass, i) => {
            const sphereGeometry = new T.SphereGeometry(0.08, 12, 12);

            // Use different colors to distinguish fixed vs. free masses
            const color = mass.fixed ? 0x666666 : 0xff4444;  // Gray for fixed, red for free

            const sphereMaterial = new T.MeshPhongMaterial({ color: color });
            const masspoint = new T.Mesh(sphereGeometry, sphereMaterial);
            masspoint.position.copy(mass.position);
            this.masspoints.push(masspoint);
            this.group.add(masspoint);
        });

        // ===== Create spring lines =====
        // Each spring gets a line connecting its two mass points
        this.springs.forEach(spring => {
            const lineGeometry = new T.BufferGeometry();

            // Get positions of the two masses this spring connects
            const mass1Pos = this.masses[spring.mass1].position;
            const mass2Pos = this.masses[spring.mass2].position;

            // Create a line with two points
            const positions = new Float32Array([
                mass1Pos.x, mass1Pos.y, mass1Pos.z,  // First endpoint
                mass2Pos.x, mass2Pos.y, mass2Pos.z   // Second endpoint
            ]);
            lineGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));

            const lineMaterial = new T.LineBasicMaterial({ color: 0x888888, linewidth: 2 });
            const springLine = new T.Line(lineGeometry, lineMaterial);
            this.springLines.push(springLine);
            this.group.add(springLine);
        });
    }

    /**
     * Update simulation for all masses.
     * Key difference from cl-01-01.js: Each mass may be connected to MULTIPLE springs!
     * We need to accumulate forces from all connected springs.
     */
    stepWorld(delta, timeOfDay) {
        const springConstant = (this.values && this.values["Spring Stiffness"] !== undefined) ? this.values["Spring Stiffness"] : 20;
        const timestep = (this.values && this.values["Timestep"] !== undefined) ? this.values["Timestep"] : 0.02;
        const damping = (this.values && this.values["Damping"] !== undefined) ? this.values["Damping"] : 0.98;
        const gravityY = (this.values && this.values["Gravity"] !== undefined) ? this.values["Gravity"] : -9.8;

        const dt = timestep;

        // Update each mass point
        this.masses.forEach((mass, i) => {
            if (!mass.fixed) {
                // Start with gravity force
                const totalForce = new T.Vector3(0, gravityY * this.mass, 0);

                // ===== Accumulate spring forces from ALL connected springs =====
                // This is the key difference: a mass point can be connected to multiple springs!
                // For example, mass 2 is connected to BOTH spring 1 (to mass 0) and spring 3 (to mass 3)
                this.springs.forEach(spring => {
                    // Check if this spring is connected to the current mass
                    if (spring.mass1 === i || spring.mass2 === i) {
                        // Find the OTHER mass that this spring connects to
                        const otherMassIndex = spring.mass1 === i ? spring.mass2 : spring.mass1;
                        const otherMass = this.masses[otherMassIndex];

                        // Calculate spring force using Hooke's Law (same as before)
                        const displacement = new T.Vector3().subVectors(mass.position, otherMass.position);
                        const currentLength = displacement.length();

                        if (currentLength > 0) {
                            const extension = currentLength - this.restLength;
                            const springDirection = displacement.clone().normalize();
                            const springForce = springDirection.clone().multiplyScalar(-springConstant * extension);

                            // Add this spring's force to the total
                            totalForce.add(springForce);
                        }
                    }
                });

                // Apply Newton's second law and Explicit Euler integration
                const acceleration = totalForce.clone().divideScalar(this.mass);
                mass.position.add(mass.velocity.clone().multiplyScalar(dt));
                mass.velocity.add(acceleration.clone().multiplyScalar(dt));
                mass.velocity.multiplyScalar(damping);

                // ===== NaN Detection =====
                // With MORE springs, instability happens MORE EASILY
                // This is because errors can compound through the spring network
                if (isNaN(mass.position.x) || isNaN(mass.position.y) || isNaN(mass.position.z) ||
                    isNaN(mass.velocity.x) || isNaN(mass.velocity.y) || isNaN(mass.velocity.z) ||
                    mass.position.length() > 1000 || mass.velocity.length() > 1000) {
                    console.log("NaN value detected! Simulation became unstable.");
                    console.log("Note: Systems with more springs are MORE prone to instability!");
                    return;
                }
            }
        });

        // ===== Update Visuals =====
        // Update the position of all mass point spheres
        this.masses.forEach((mass, i) => {
            this.masspoints[i].position.copy(mass.position);
        });

        // Update all spring lines to connect their respective masses
        this.springs.forEach((spring, i) => {
            const positions = this.springLines[i].geometry.attributes.position.array;
            const mass1Pos = this.masses[spring.mass1].position;
            const mass2Pos = this.masses[spring.mass2].position;
            positions[0] = mass1Pos.x;
            positions[1] = mass1Pos.y;
            positions[2] = mass1Pos.z;
            positions[3] = mass2Pos.x;
            positions[4] = mass2Pos.y;
            positions[5] = mass2Pos.z;
            this.springLines[i].geometry.attributes.position.needsUpdate = true;
        });
    }
}

// ===== Setup World and Scene =====
// Create the 3D world without a default ground plane
let world = new GrWorld({groundplane: false, where: document.getElementById("div1")});

// Add lighting to the scene
world.scene.add(new T.AmbientLight(0x404040, 0.4));  // Soft ambient light
const directionalLight = new T.DirectionalLight(0xffffff, 0.8);  // Main directional light
directionalLight.position.set(5, 10, 5);
world.scene.add(directionalLight);

// ===== Create the Simulation =====
const rectangularSystem = new RectangularMassSpringSystem();
world.add(rectangularSystem);

// Create UI controls for adjusting parameters
new AutoUI(rectangularSystem);

// ===== Add Reset Button =====
// This allows users to reset the simulation if it becomes unstable
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
    rectangularSystem.resetSimulation();
});

document.body.appendChild(resetButton);

// ===== Setup Camera =====
world.camera.position.set(6, 3, 6);  // Position camera to get a good view
world.camera.lookAt(0, 1, 0);         // Look at the center of the system

// ===== Start Animation Loop =====
world.go();
// CS559 2025 Workbook
