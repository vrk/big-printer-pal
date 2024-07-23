import "./css/index.css";
import {
  Canvas,
  Line,
  Group,
  iMatrix,
  Rect,
  Shadow,
  util,
  Point,
  FabricObject,
  FabricImage,
  ImageFormat,
} from "fabric";
import { changeDpiDataUrl } from "changedpi";

// TODO: Check out https://codepen.io/janih/pen/EjaNXP for snap to grid

const canvas = new Canvas("html-canvas", {
  controlsAboveOverlay: true,
});

const CANVAS_DEFAULT_PPI = 72; // TODO: Kinda wrong I think but we'll keep this value for now
const DEFAULT_PPI = 300;
const DEFAULT_WIDTH_IN_INCHES = 8.5;
const DEFAULT_HEIGHT_IN_INCHES = 11;
const DEFAULT_DOC_BORDER_SIZE_IN_PIXELS = 4;
const BACKGROUND_RECT_ID = '__background-id__';

let ppi = DEFAULT_PPI;
let docWidth = DEFAULT_WIDTH_IN_INCHES * ppi;
let docHeight = DEFAULT_HEIGHT_IN_INCHES * ppi;

function getPPIRatio() {
  return ppi / CANVAS_DEFAULT_PPI;
  // return 1;
}

const overallContainer = document.getElementById("fabric-canvas-container");

function getDocStrokeWidth() {
  return 4 * getPPIRatio();
}

const doc = new Rect({
  id: BACKGROUND_RECT_ID,
  fill: "white",
  width: docWidth,
  height: docHeight,

  stroke: "#4B624C",
  strokeWidth: getDocStrokeWidth(),
  selectable: false,
  hasControls: false,
  hoverCursor: "default",
});

canvas.add(doc);
canvas.centerObject(doc);
canvas.clipPath = doc;
setCanvasDimensions();

window.addEventListener("resize", function () {
  setCanvasDimensions();
});

// From vue-fabric-editor
function setCenterFromObject(obj: Rect) {
  const objCenter = obj.getCenterPoint();
  const viewportTransform = canvas.viewportTransform;
  if (
    canvas.width === undefined ||
    canvas.height === undefined ||
    !viewportTransform
  )
    return;
  viewportTransform[4] = canvas.width / 2 - objCenter.x * viewportTransform[0];
  viewportTransform[5] = canvas.height / 2 - objCenter.y * viewportTransform[3];
  canvas.setViewportTransform(viewportTransform);
  canvas.renderAll();
}

function setCanvasDimensions() {
  console.log("set canvas dim");
  canvas.setDimensions({
    width: overallContainer.offsetWidth,
    height: overallContainer.offsetHeight,
  });
  // canvas.setDimensions(
  //   {
  //     width: `${overallContainer.offsetWidth}px`,
  //     height: `${overallContainer.offsetHeight}px`,
  //   },
  //   { cssOnly: true }
  // );
  // canvas.setDimensions(
  //   {
  //     width: overallContainer.offsetWidth * getPPIRatio(),
  //     height: overallContainer.offsetHeight * getPPIRatio(),
  //   },
  //   { backstoreOnly: true }
  // );
  const center = canvas.getCenterPoint();
  let scale = util.findScaleToFit(doc, canvas) * 0.7; // TODO: fix eyeballing
  const strokeWidth = Math.round(DEFAULT_DOC_BORDER_SIZE_IN_PIXELS / scale);
  doc.strokeWidth = strokeWidth;

  // HACK: TODO: This is done so that zoom level is preserved on resize. Proper
  // fix would be to call a special init method for first time canvas dimension setting,
  // and then have a different method for window resizes.
  if (canvas.getZoom() !== 1) {
    scale = canvas.getZoom();
  }
  // END HACK

  canvas.zoomToPoint(center, scale);
  setCenterFromObject(doc);
  canvas.renderAll();
}

function redoClone(toClone: Canvas) {
  const canvas = toClone.cloneWithoutData();
  const json = toClone.toObject(['id']);
  return canvas.loadFromJSON(json);
}

const printButton = document.getElementById("download-to-print");
printButton.addEventListener("click", async () => {

  // Clone canvas and remove background rect.
  const clonedCanvas = await redoClone(canvas);
  const objects = clonedCanvas.getObjects();
  const object = objects.find((obj) => { 
    if (obj.id === BACKGROUND_RECT_ID) {
      return obj;
    }
  });
  clonedCanvas.remove(object);

  clonedCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  const { left, top, width, height } = doc;
  const format: ImageFormat = "png";
  const options = {
    name: "New Image",
    format,
    quality: 1,
    width,
    height,
    left,
    top,
    multiplier: 1,
  };
  console.log('data url start', performance.now());
  const dataUrl = clonedCanvas.toDataURL(options);
  console.log('data url finished', performance.now());
  const dataUrlAdjustedDPI = changeDpiDataUrl(dataUrl, ppi);
  console.log('change dpi finished', performance.now());
  // downloadFile(dataUrlAdjustedDPI, "saved.png");
  await window.electronAPI.downloadFile(dataUrlAdjustedDPI);
});

function downloadFile(dataUrl: string, filename: string) {
  console.log('start create a element', performance.now());
  const anchorEl = document.createElement("a");
  anchorEl.href = dataUrl;
  anchorEl.download = filename;
  console.log('element download created', performance.now());
  // document.body.appendChild(anchorEl); // required for firefox
  anchorEl.click();
  console.log('element download clicked', performance.now());
  anchorEl.remove();
  console.log('element download removed', performance.now());
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
      const center = canvas.getCenterPoint();
      canvas.zoomToPoint(center, zoom);

      // TODO: why doesn't this work better than it does
      const strokeWidth = Math.round(
        DEFAULT_DOC_BORDER_SIZE_IN_PIXELS / canvas.getZoom()
      );
      doc.strokeWidth = strokeWidth;
      canvas.renderAll();
    } else {
      console.log(canvas.viewportTransform);
      // pan up and down

      const vpt = this.viewportTransform;
      vpt[5] -= delta;
      canvas.setViewportTransform(vpt);
      enclose(canvas, doc);
    }
  });
});

document.addEventListener("keydown", function (event) {
  console.log(event);
  if (event.key == "Alt" || event.key === "Meta") {
    altKeyPressed = true;
  }
});

document.addEventListener("keyup", function (event) {
  if (event.key === "Alt" || event.key === "Meta") {
    altKeyPressed = false;
  } else if (event.key === "Backspace" || event.key === "Delete") {
    const active = canvas.getActiveObject();
    if (!active) {
      return;
    }
    canvas.remove(active);
  }
});

const addImageButton = document.getElementById("add-image");
addImageButton.addEventListener("click", async () => {
  console.log("hi");
  const base64 = await window.electronAPI.openFile();
  const url = `data:image/png;base64,${base64}`;
  const image = await FabricImage.fromURL(url);
  image.set({
    transparentCorners: false,
    selectable: true,
  });
  image.setControlsVisibility({
    mt: false, // middle top disable
    mb: false, // midle bottom
    ml: false, // middle left
    mr: false,
  });
  image.snapAngle = 5;
  canvas.add(image);
  canvas.viewportCenterObject(image);
  canvas.setActiveObject(image);
  canvas.bringObjectToFront(image);
});

/******
 *
 *
 * from https://github.com/fabricjs/fabric.js/discussions/7052
 */

// create Fabric canvas
canvas.on("mouse:down", onMouseDown);
canvas.on("mouse:move", onMouseMove);
canvas.on("mouse:up", onMouseUp);

let isDragging = false;
let lastPosX: any = null;
let lastPosY: any = null;

function enclose(canvas: Canvas, object: Rect) {
  const {
    br: brRaw, // bottom right
    tl: tlRaw, // top left
  } = object.aCoords;
  const T = canvas.viewportTransform;
  const br = brRaw.transform(T);
  const tl = tlRaw.transform(T);
  const { x: left, y: top } = tl;
  const { x: right, y: bottom } = br;
  const { width, height } = canvas;
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
  const { clientX, clientY } = positionSource;
  return {
    clientX,
    clientY,
  };
}

function onMouseDown(opt) {
  // Ignore clicks on doc or objects
  if (opt.target !== undefined) {
    console.log("nup");
    return false;
  }

  canvas.setCursor("grabbing");

  const { e } = opt;
  const { clientX, clientY } = getClientPosition(e);

  isDragging = true;
  lastPosX = clientX;
  lastPosY = clientY;
  canvas.selection = false;
  canvas.discardActiveObject();
}

function onMouseMove(opt) {
  if (!isDragging) {
    if (opt.target === undefined) {
      canvas.setCursor("grab");
    }
    return;
  }
  const { e } = opt;
  const T = canvas.viewportTransform;
  const { clientX, clientY } = getClientPosition(e);
  T[4] += clientX - lastPosX;
  T[5] += clientY - lastPosY;
  canvas.requestRenderAll();
  lastPosX = clientX;
  lastPosY = clientY;
  enclose(canvas, doc);
}

function onMouseUp(opt) {
  const { x, y } = opt.absolutePointer;
  canvas.setViewportTransform(canvas.viewportTransform);
  isDragging = false;
  canvas.selection = true;
}
