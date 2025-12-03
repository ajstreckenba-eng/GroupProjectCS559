import * as T from "../libs/CS559-Three/build/three.module.js";
import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { GrObject } from "../libs/CS559-Framework/GrObject.js";
import { AutoUI } from "../libs/CS559-Framework/AutoUI.js";

/**
 * Simple Mass-Spring System
 *
 * This is the simplest mass-spring simulation.:
 * 1. Hooke's Law: F = -k * (x - x_0) * d
 * 2. Explicit Euler Integration for time stepping
 * 3. How numerical instability can occur with large timesteps or high stiffness
 *
 * Try experimenting with the UI parameters to see when the simulation becomes unstable!
 */
class MassSpringSystem extends GrObject {
    constructor() {
        const group = new T.Group();

        // UI parameters to experiment with
        // Notice how increasing stiffness or timestep can cause instability
        super("MassSpringSystem", group, [
            ["Spring Stiffness", 1, 500, 20, 1],      // k in Hooke's law
            ["Timestep", 0.001, 1.0, 0.02, 0.001],    // Δt for time integration
            ["Damping", 0.90, 0.999, 0.98, 0.001],    // Non-physical damping (0-1)
            ["Gravity", -50, 0, -9.8, 0.1]            // Gravity acceleration (m/s²)
        ]);

        this.group = group;

        // Physics parameters
        this.mass = 1.0;                              // Mass in kg
        this.gravity = new T.Vector3(0, -9.8, 0);     // Gravity vector
        this.restLength = 2.0;                        // Natural length of spring (x_0)
        this.anchorPoint = new T.Vector3(0, 3, 0);    // Fixed point where spring is attached

        // Initialize simulation
        this.resetSimulation();
        this.createVisuals();
    }

    resetSimulation() {
        // Start with a moderate displacement from equilibrium
        // This gives the spring some initial stretch to create motion
        this.position = new T.Vector3(1.5, 1.5, 0);
        this.velocity = new T.Vector3(0, 0, 0);       // Start at rest

        // Reset debug counter
        this.debugCount = 0;

        console.log("Simulation reset, new position:", this.position);

        // Update visuals immediately after reset
        if (this.sphere) {
            this.sphere.position.copy(this.position);
            if (this.updateVisuals) {
                this.updateVisuals();
            }
        }
    }

    createVisuals() {
        // Create visual representation of the mass-spring system

        // Mass (red sphere) - this is the moving particle
        const sphereGeometry = new T.SphereGeometry(0.12, 16, 16);
        const sphereMaterial = new T.MeshPhongMaterial({ color: 0xff4444 });
        this.sphere = new T.Mesh(sphereGeometry, sphereMaterial);
        this.sphere.position.copy(this.position);

        // Spring (line) - visualizes the connection between anchor and mass
        const lineGeometry = new T.BufferGeometry();
        const positions = new Float32Array([
            this.anchorPoint.x, this.anchorPoint.y, this.anchorPoint.z,
            this.position.x, this.position.y, this.position.z
        ]);
        lineGeometry.setAttribute('position', new T.BufferAttribute(positions, 3));
        const lineMaterial = new T.LineBasicMaterial({ color: 0x888888, linewidth: 2 });
        this.springLine = new T.Line(lineGeometry, lineMaterial);

        // Anchor point (gray sphere) - this is the fixed attachment point
        const anchorGeometry = new T.SphereGeometry(0.08, 12, 12);
        const anchorMaterial = new T.MeshPhongMaterial({ color: 0x666666 });
        this.anchor = new T.Mesh(anchorGeometry, anchorMaterial);
        this.anchor.position.copy(this.anchorPoint);

        // Add all visual elements to the scene
        this.group.add(this.sphere);
        this.group.add(this.springLine);
        this.group.add(this.anchor);
    }

    /**
     * This function is called every frame to update the simulation.
     * It implements the core physics loop:
     * 1. Calculate forces (spring + gravity)
     * 2. Calculate acceleration (F = ma)
     * 3. Update velocity and position (using Explicit Euler)
     */
    stepWorld(delta, timeOfDay) {
        // Get parameter values from UI with safe defaults
        const springConstant = (this.values && this.values["Spring Stiffness"] !== undefined) ? this.values["Spring Stiffness"] : 20;
        const timestep = (this.values && this.values["Timestep"] !== undefined) ? this.values["Timestep"] : 0.02;
        const damping = (this.values && this.values["Damping"] !== undefined) ? this.values["Damping"] : 0.98;
        const gravityY = (this.values && this.values["Gravity"] !== undefined) ? this.values["Gravity"] : -9.8;

        const dt = timestep;

        // ===== Step 1: Calculate Spring Force using Hooke's Law =====
        // F = -k * (x - x_0) * d
        // where:
        //   k = spring stiffness constant
        //   (x - x_0) = extension/compression amount
        //   d = direction vector (unit vector pointing from anchor to mass)

        const displacement = new T.Vector3().subVectors(this.position, this.anchorPoint);
        const currentLength = displacement.length();        // Current spring length
        const extension = currentLength - this.restLength;  // How much spring is stretched/compressed
        const springDirection = displacement.clone().normalize();  // Direction from anchor to mass

        // Spring force pulls back toward rest length
        const springForce = springDirection.clone().multiplyScalar(-springConstant * extension);

        // ===== Step 2: Calculate Total Force =====
        // In a real simulation, forces add up (superposition principle)
        const gravityForce = new T.Vector3(0, gravityY * this.mass, 0);
        const totalForce = springForce.clone().add(gravityForce);

        // ===== Step 3: Calculate Acceleration using Newton's Second Law =====
        // F = ma  →  a = F/m
        const acceleration = totalForce.clone().divideScalar(this.mass);

        // ===== Step 4: Time Integration using Explicit Euler Method =====
        // Explicit Euler updates position and velocity based on CURRENT state:
        //   x_{t+1} = x_t + v_t * Δt
        //   v_{t+1} = v_t + a_t * Δt
        //
        // 
        // Explicit Euler integration
        this.position.add(this.velocity.clone().multiplyScalar(dt));
        this.velocity.add(acceleration.clone().multiplyScalar(dt));

        // Apply non-physical damping to reduce velocity
        // This helps prevent instability but isn't realistic
        this.velocity.multiplyScalar(damping);

        // ===== Step 5: Stability Check =====
        const distance = this.position.distanceTo(this.anchorPoint);
        const speed = this.velocity.length();

        // NaN (Not a Number) detection: Essential for any simulation code!
        // If the simulation becomes unstable, values can become NaN or infinity
        // This happens when timestep is too large or spring is too stiff
        if (isNaN(this.position.x) || isNaN(this.position.y) || isNaN(this.position.z) ||
            isNaN(this.velocity.x) || isNaN(this.velocity.y) || isNaN(this.velocity.z) ||
            distance > 1000 || speed > 1000) {
            console.log("NaN value detected! Simulation became unstable.");
            console.log("Try reducing timestep or spring stiffness.");
            return;
        }

        // Update visual representation
        this.updateVisuals();
    }

    /**
     * Update the visual representation to match the physics state.
     * This is called after each physics update.
     */
    updateVisuals() {
        // Update sphere position to match the simulated mass position
        this.sphere.position.copy(this.position);

        // Update spring line to connect anchor and current mass position
        const positions = this.springLine.geometry.attributes.position.array;
        positions[0] = this.anchorPoint.x;
        positions[1] = this.anchorPoint.y;
        positions[2] = this.anchorPoint.z;
        positions[3] = this.position.x;
        positions[4] = this.position.y;
        positions[5] = this.position.z;
        // Tell THREE.js that the geometry has changed and needs to be re-rendered
        this.springLine.geometry.attributes.position.needsUpdate = true;
    }
}

// Create world and simulation
let world = new GrWorld({groundplane: false});

// Add lighting
world.scene.add(new T.AmbientLight(0x404040, 0.4));
const directionalLight = new T.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 5);
world.scene.add(directionalLight);

// Create mass-spring system
const massSpringSystem = new MassSpringSystem();
world.add(massSpringSystem);

// Create UI controls
new AutoUI(massSpringSystem);

// Add reset button
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
    massSpringSystem.resetSimulation();
});

document.body.appendChild(resetButton);

// Set camera position
world.camera.position.set(8, 2, 8);
world.camera.lookAt(0, 2, 0);

// Start simulation
world.go();
// CS559 2025 Workbook
