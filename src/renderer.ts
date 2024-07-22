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

let zoomin = false;
// canvas.on('mouse:wheel', function(opt) {
//   if (zoomin) {
//     console.log('already zoomin');
//     return;
//   }
//   zoomin = true;
//   const delta = opt.e.deltaY;
//   let zoom = this.getZoom();
//   zoom *= 0.999 ** delta;
//   if (zoom > 5) zoom = 5;
//   if (zoom < 0.01) zoom = 0.01;
//   const center = this.getCenter();
//   this.zoomToPoint(new Point(center.left, center.top), zoom);
//   opt.e.preventDefault();
//   opt.e.stopPropagation();
//   zoomin = false;
// });

// canvas.on('mouse:down', function(opt) {
//   var evt = opt.e as MouseEvent;
//   console.log(evt);
//   if (evt.altKey === true) {
//     this.isDragging = true;
//     this.selection = false;
//     this.lastPosX = evt.clientX;
//     this.lastPosY = evt.clientY;
//   }
// });

// canvas.on('mouse:move', function(opt) {
//   if (this.isDragging) {
//     var e = opt.e as MouseEvent;
//     var vpt = this.viewportTransform;
//     vpt[4] += (e.clientX - this.lastPosX) * getPPIRatio();
//     vpt[5] += (e.clientY - this.lastPosY) * getPPIRatio();
//     this.requestRenderAll();
//     this.lastPosX = e.clientX;
//     this.lastPosY = e.clientY;
//   }
// });

// canvas.on('mouse:up', function(opt) {
//   // on mouse up we want to recalculate new interaction
//   // for all objects, so we call setViewportTransform
//   this.setViewportTransform(this.viewportTransform);
//   this.isDragging = false;
//   this.selection = true;
// });

// // from just after the function applyZoom replace all the code
// var mouse = {  // holds the mouse state
//   x : 0,
//   y : 0,
//   down : false,
//   w : 0,
//   delta : new fabric.Point(0,0),
// }
// // event just track mouse state
// function zoom(e) {
//   if(e != null) { e.preventDefault() }
//   var evt=window.event || e;
//   mouse.x = e.offsetX;
//   mouse.y = e.offsetY;
//   mouse.w += evt.detail? evt.detail*(-120) : evt.wheelDelta;
//   return false;
// }

// from just after the function applyZoom replace all the code
var mouse = {
  // holds the mouse state
  x: 0,
  y: 0,
  down: false,
  w: 0,
  delta: new Point(0, 0),
};
// event just track mouse state
function zoom(event: WheelEvent) {
  if (event != null) {
    event.preventDefault();
  }
  mouse.x = event.offsetX;
  mouse.y = event.offsetY;
  mouse.w += event.deltaY * getPPIRatio();
  return false;
}

overallContainer.addEventListener("mousewheel", zoom, false);
overallContainer.addEventListener("DOMMouseScroll", zoom, false);

canvas.on("mouse:up", function (e) {
  mouse.down = false;
});
canvas.on("mouse:out", function (e) {
  mouse.down = false;
});
canvas.on("mouse:down", function (e) {
  mouse.down = true;
});
canvas.on("mouse:move", function (e) {
  if (e && e.e) {
    mouse.delta.x += e.e.clientX;
    mouse.delta.y += e.e.clientY;
  }
});

// main animation loop
function update() {
  if (mouse.w !== 0) {
    // if the wheel has moved do zoom
    const curZoom = canvas.getZoom();
    const center = canvas.getCenterPoint();
    canvas.zoomToPoint(center, curZoom + mouse.w / 4000);
    mouse.w = 0; // consume wheel delta
  } else if (mouse.down) {
    // if mouse button down
    canvas.relativePan(mouse.delta);
  }
  // consume mouse delta
  mouse.delta.x = 0;
  mouse.delta.y = 0;

  requestAnimationFrame(update);
}
requestAnimationFrame(update);
