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

import { Canvas, Rect, Shadow, util, Point } from "fabric"; // browser

const canvas = new Canvas("html-canvas",);
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

  // width: 100,
  // height: 100,
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
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 2) zoom = 2;
      if (zoom < 0.1) zoom = 0.1;
      const center = canvas.getCenterPoint()
      canvas.zoomToPoint(center, zoom);
    } else {
      console.log(canvas.viewportTransform)
      // pan up and down

      const vpt = this.viewportTransform;
      vpt[5] -= delta * getPPIRatio();
      canvas.setViewportTransform(vpt);
      enclose(canvas, doc);
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



/******
 * 
 * 
 * from https://github.com/fabricjs/fabric.js/discussions/7052
 */



// create Fabric canvas
canvas.on('mouse:down', onMouseDown);
canvas.on('mouse:move', onMouseMove);
canvas.on('mouse:up', onMouseUp);


let isDragging = false;
let lastPosX: any = null;
let lastPosY: any = null;
let zoomStartScale;


// function onMouseWheel(opt) {
//   const {
//     e
//   } = opt;
//   enclose(canvas, doc);
//   e.preventDefault();
//   e.stopPropagation();
// }

// function zoomDelta(canvas, delta, x, y, maxZoom = 5, minZoom = 0.2) {
//   let zoom = canvas.getZoom();
//   zoom *= 0.999 ** delta;
//   zoom = Math.min(zoom, maxZoom);
//   zoom = Math.max(zoom, minZoom);
//   const point = {
//     x,
//     y
//   };
//   canvas.zoomToPoint(point, zoom);
// }

function enclose(canvas: Canvas, object: Rect) {
  const {
    br: brRaw, // bottom right
    tl: tlRaw // top left
  } = object.aCoords;
  const T = canvas.viewportTransform;
  const br = brRaw.transform(T);
  const tl = tlRaw.transform(T);
  const {
    x: left,
    y: top
  } = tl;
  const {
    x: right,
    y: bottom
  } = br;
  const {
    width,
    height
  } = canvas;
  // const width = overallContainer.offsetWidth;
  // const height = overallContainer.offsetHeight;
  // calculate how far to translate to line up the edge of the object with  
  // the edge of the canvas                                                 
  const dLeft = Math.abs(right - width);
  const dRight = Math.abs(left);
  const dUp = Math.abs(bottom - height);
  const dDown = Math.abs(top);
  // if the object is larger than the canvas, clamp translation such that   
  // we don't push the opposite boundary past the edge                      
  const maxDx = Math.min(dLeft, dRight);
  const maxDy = Math.min(dUp, dDown);
  const leftIsOver = left < 0;
  const rightIsOver = right > width;
  const topIsOver = top < 0;
  const bottomIsOver = bottom > height;
  const translateLeft = rightIsOver && !leftIsOver;
  const translateRight = leftIsOver && !rightIsOver;
  const translateUp = bottomIsOver && !topIsOver;
  const translateDown = topIsOver && !bottomIsOver;
  const dx = translateLeft ? -maxDx : translateRight ? maxDx : 0;
  const dy = translateUp ? -maxDy : translateDown ? maxDy : 0;
  if (dx || dy) {
    T[4] += dx;
    T[5] += dy;
    canvas.requestRenderAll();
  }
}

function getClientPosition(e) {
  const positionSource = e.touches ? e.touches[0] : e;
  const {
    clientX,
    clientY
  } = positionSource;
  return {
    clientX,
    clientY
  };
}

function onMouseDown(opt) {
  // Ignore clicks on doc or objects
  if (opt.target !== undefined) {
    return;
  }

  canvas.setCursor('grabbing');

  const {
    e
  } = opt;
  const {
    clientX,
    clientY
  } = getClientPosition(e);

  isDragging = true;
  lastPosX = clientX;
  lastPosY = clientY;
  canvas.selection = false;
  canvas.discardActiveObject();
}

function onMouseMove(opt) {
  if (!isDragging) {
    if (opt.target === undefined) {
      canvas.setCursor('grab');
    }
    return;
  }
  const {
    e
  } = opt;
  const T = canvas.viewportTransform;
  const {
    clientX,
    clientY
  } = getClientPosition(e);
  T[4] += (clientX - lastPosX) * getPPIRatio();
  T[5] += (clientY - lastPosY) * getPPIRatio();
  canvas.requestRenderAll();
  lastPosX = clientX;
  lastPosY = clientY;
  enclose(canvas, doc);
}

function onMouseUp(opt) {
  const {
    x,
    y
  } = opt.absolutePointer;
  canvas.setViewportTransform(canvas.viewportTransform);
  isDragging = false;
  canvas.selection = true;
}