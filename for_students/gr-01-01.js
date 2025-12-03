/*jshint esversion: 6 */
// @ts-check

import { GrWorld } from "../libs/CS559-Framework/GrWorld.js";
import { WorldUI } from "../libs/CS559-Framework/WorldUI.js";
import { GrCity } from "./building.js";
import * as T from "../libs/CS559-Three/build/three.module.js";

const fogColor = new T.Color(0xffffff);

// make the world
let world = new GrWorld({
  width: 800,
  height: 600,
  renderparams: {
    antialias: true,
  },
});

world.groundplane.material.visible = false;

const bigCity = new GrCity({
  seed: 12345,
  gridSize: 16,
  blockSize: 4,
  roadWidth: 2,
  fogParams: {
    color: fogColor,
    near: 0,
    far: 8,
  },
});

world.add(bigCity);
world.scene.background = fogColor;

// world.active_camera = bigCity.monorails[2].camera;

function highlight(obName) {
  const toHighlight = world.objects.find((ob) => ob.name === obName);
  if (toHighlight) {
    toHighlight.highlighted = true;
  } else {
    throw `no object named ${obName} for highlighting!`;
  }
}

world.go();

// CS559 2025 Workbook
