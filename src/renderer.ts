/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./css/index.css";

console.log(
  '👋 This message is being logged by "renderer.ts", included via Vite'
);

import { Canvas, Rect, Shadow, Point } from "fabric"; // browser

const canvas = new Canvas("html-canvas", {
  backgroundColor: "gray",
});
const CANVAS_DEFAULT_PPI = 72; // TODO: Kinda wrong I think but we'll keep this value for now

const DEFAULT_PPI = 300;
const DEFAULT_WIDTH_IN_INCHES = 8.5;
const DEFAULT_HEIGHT_IN_INCHES = 11;

let ppi = DEFAULT_PPI;
let docWidth = DEFAULT_WIDTH_IN_INCHES * ppi;
let docHeight = DEFAULT_HEIGHT_IN_INCHES * ppi;

function getPPIRatio() {
  return ppi / CANVAS_DEFAULT_PPI;
  // return 1;
}

const overallContainer = document.getElementById("fabric-canvas-container");

const doc = new Rect({
  fill: "white",
  width: 8.5 * ppi,
  height: 11 * ppi,

  stroke: "#4B624C",
  strokeWidth: 2 * getPPIRatio(),
  /* x offset | y offset | blur | spread | <color> */
  // shadow: new Shadow("0 4px 4px 0 rgba(0, 0, 0, 0.25")
  shadow: new Shadow({
    color: "rgba(0, 0, 0, 0.25)",
    blur: 0.05 * ppi,
    offsetY: 0.05 * ppi,
    offsetX: 0,
  }),
});

doc.set("selectable", false);
doc.set("hasControls", false);
doc.hoverCursor = "default";

setCanvasDimensions();
// canvas.setZoom(0.75);
canvas.add(doc);
canvas.centerObject(doc);
// canvas.renderAll();

window.addEventListener("resize", function () {
  setCanvasDimensions();
});

function setCanvasDimensions() {
  // canvas.setDimensions({
  //   width: overallContainer.offsetWidth,
  //   height: overallContainer.offsetHeight,
  // });
  canvas.setDimensions(
    {
      width: `${overallContainer.offsetWidth}px`,
      height: `${overallContainer.offsetHeight}px`,
    },
    { cssOnly: true }
  );
  canvas.setDimensions(
    {
      width: overallContainer.offsetWidth * getPPIRatio(),
      height: overallContainer.offsetHeight * getPPIRatio(),
    },
    { backstoreOnly: true }
  );
  // canvas.setZoom(0.75);
  canvas.centerObject(doc);
}

let altKeyPressed = false;
canvas.on("mouse:wheel", function (opt) {
  opt.e.preventDefault();
  opt.e.stopPropagation();
  requestAnimationFrame(() => {
    const delta = opt.e.deltaY;
    if (altKeyPressed) {
      let zoom = this.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 2) zoom = 2;
      if (zoom < 0.1) zoom = 0.1;
      const center = this.getCenter();
      this.zoomToPoint(new Point(center.left, center.top), zoom);
    } else {
      // pan up and down

      const vpt = this.viewportTransform;
      vpt[5] -= delta * getPPIRatio();
      this.setViewportTransform(vpt);
    }
  });
});

document.addEventListener("keydown", function (event) {
  console.log(event);
  if (event.key == 'Alt' || event.key === "Meta") {
    altKeyPressed = true;
  }
});

document.addEventListener("keyup", function (event) {
  console.log(event);
  if (event.key == 'Alt' || event.key === "Meta") {
    altKeyPressed = false;
  }
});
