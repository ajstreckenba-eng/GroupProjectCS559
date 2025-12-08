import { Random } from "./random.js";
import * as T from "../libs/CS559-Three/build/three.module.js";
import { createBronzeMaterial } from "./materials.js";

function shuffleArray(random, array) {
  for (let i = array.length - 1; i >= 1; i--) {
    const j = random.next() % i;
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function pathSteps(random, from, to) {
  let current = [from[0], from[1]];
  let steps = [];

  while (current[0] < to[0]) {
    steps.push([1, 0]);
    current[0]++;
  }

  while (current[0] > to[0]) {
    steps.push([-1, 0]);
    current[0]--;
  }

  while (current[1] < to[1]) {
    steps.push([0, 1]);
    current[1]++;
  }

  while (current[1] > to[1]) {
    steps.push([0, -1]);
    current[1]--;
  }

  return shuffleArray(random, steps);
}

function randomPath(random, from, to) {
  const steps = pathSteps(random, from, to);
  let path = [[from[0], from[1]]];
  for (let step of steps) {
    const prev = path[path.length - 1];
    path.push([prev[0] + step[0], prev[1] + step[1]]);
  }
  // Remove the last position since it'll be added anyway from the next path segment.
  path.pop();
  return path;
}

function generatePath(random, gridSize) {
  const halfGridSize = Math.floor(gridSize / 2);
  const upperLeft = [
    random.next() % halfGridSize,
    random.next() % halfGridSize,
  ];
  const lowerLeft = [
    random.next() % halfGridSize,
    (random.next() % halfGridSize) + halfGridSize,
  ];
  const upperRight = [
    (random.next() % halfGridSize) + halfGridSize,
    random.next() % halfGridSize,
  ];
  const lowerRight = [
    (random.next() % halfGridSize) + halfGridSize,
    (random.next() % halfGridSize) + halfGridSize,
  ];
  return [].concat(
    randomPath(random, upperLeft, lowerLeft),
    randomPath(random, lowerLeft, lowerRight),
    randomPath(random, lowerRight, upperRight),
    randomPath(random, upperRight, upperLeft),
  );
}

export class Monorail {
  constructor(random, gridSize, height, blockSize, roadWidth) {
    let path = generatePath(random, gridSize);
    this.path = path;
    this.height = height;

    let points = path.map(([i, j]) => {
      const x = i * (blockSize + roadWidth);
      const z = j * (blockSize + roadWidth);
      return new T.Vector3(x, height, z);
    });

    this.curve = new T.CatmullRomCurve3(points, true);

    const geometry = new T.TubeGeometry(this.curve, 256, 0.1, 8, true);
    const material = createBronzeMaterial();
    this.mesh = new T.Mesh(geometry, material);

    let car = new T.Mesh(new T.BoxGeometry(1, 1, 2), material);
    this.car = car;
    this.carProgress = 0;

    this.camera = new T.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.rotateY(Math.PI);
    this.car.add(this.camera);
  }

  positionAt(t) {
    return this.curve.getPointAt(t);
  }

  step(delta) {
    this.carProgress += delta * 0.00001;
    this.carProgress %= 1.0;

    let position = this.positionAt(this.carProgress);
    position.y += 0.5;
    const tangent = this.curve.getTangentAt(this.carProgress);

    this.car.position.copy(position);
    this.car.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), tangent);
  }
}

export function addPillars(group, monorails, blockSize, roadWidth) {
  function isMonorailUnder(pos, index) {
    for (let i = index - 1; i >= 0; i--) {
      let monorail = monorails[i];

      for (let j = 0; j < monorail.path.length; j++) {
        let pathPos = monorail.path[j];
        if (pathPos[0] == pos[0] && pathPos[1] == pos[1]) {
          return true;
        }
      }
    }

    return false;
  }

  const material = createBronzeMaterial();

  for (let i = 0; i < monorails.length; i++) {
    let monorail = monorails[i];
    for (let j = 0; j < monorail.path.length; j++) {
      let gridPos = monorail.path[j];

      if (isMonorailUnder(gridPos, i)) {
        continue;
      }

      let pos = new T.Vector3(
        gridPos[0] * (blockSize + roadWidth),
        monorail.height,
        gridPos[1] * (blockSize + roadWidth),
      );

      let geometry = new T.CylinderGeometry(0.1, 0.1, pos.y);
      let pillar = new T.Mesh(geometry, material);
      pillar.position.x = pos.x;
      pillar.position.z = pos.z;
      pillar.position.y = pos.y / 2;

      group.add(pillar);
    }
  }
}
