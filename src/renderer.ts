import "./css/index.css";
import {
  ActiveSelection,
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
  TPointerEventInfo,
  TPointerEvent,
} from "fabric";
import { changeDpiDataUrl } from "changedpi";

// TODO: Check out https://codepen.io/janih/pen/EjaNXP for snap to grid

const CANVAS_DEFAULT_PPI = 72; // TODO: Kinda wrong I think but we'll keep this value for now
const DEFAULT_PPI = 300;
const DEFAULT_WIDTH_IN_INCHES = 8.5;
const DEFAULT_HEIGHT_IN_INCHES = 11;
const DEFAULT_DOC_WIDTH = DEFAULT_WIDTH_IN_INCHES * DEFAULT_PPI;
const DEFAULT_DOC_HEIGHT = DEFAULT_HEIGHT_IN_INCHES * DEFAULT_PPI;
const BACKGROUND_RECT_ID = "__background-id__";
const PROPERTIES_TO_INCLUDE = [
  "id",
  "selectable",
  "hasControls",
  "hoverCursor",
  "transparentCorners",
];

let canvas = new Canvas("html-canvas", {
  controlsAboveOverlay: true,
  renderOnAddRemove: false,
});
let documentRectangle: FabricObject;
let ppi = DEFAULT_PPI;

let openedFilename: string | null = null;

const overallContainer = document.getElementById("fabric-canvas-container");

async function main() {
  const loadedData = await window.electronAPI.loadLastSaveIfAny();
  if (loadedData) {
    await loadSnapshotData(loadedData);
  } else {
    createNewCanvas();
  }
  initializeCanvas();

  document.addEventListener("paste", onPaste);
  window.electronAPI.onLocalCopy(handleLocalCopy);

  canvas.requestRenderAll();
}

function initializeCanvas() {
  setCanvasDimensions();
  setInitialPaperValues();

  canvas.on("mouse:wheel", onMouseWheel);
  canvas.on("mouse:down", onMouseDown);
  canvas.on("mouse:move", onMouseMove);
  canvas.on("mouse:up", onMouseUp);
  canvas.on("object:added", onObjectAdded);
  canvas.on("object:modified", onObjectModified);
  canvas.on("object:removed", onObjectRemoved);
  canvas.on("object:moving", onObjectMoving);
}

function teardownCanvas() {
  canvas.off("mouse:wheel", onMouseWheel);
  canvas.off("mouse:down", onMouseDown);
  canvas.off("mouse:move", onMouseMove);
  canvas.off("mouse:up", onMouseUp);

  canvas.off("object:added", onObjectAdded);
  canvas.off("object:modified", onObjectModified);
  canvas.off("object:removed", onObjectRemoved);
  canvas.off("object:moving", onObjectMoving);
}

main();

//////////////////

// TODO: fix types
async function loadSnapshotData(loadedData: any) {
  teardownCanvas();

  ppi = loadedData.snapshot.ppi;
  canvas = await canvas.loadFromJSON(loadedData.snapshot.canvasData);
  documentRectangle = canvas
    .getObjects()
    .find((obj) => obj.id === BACKGROUND_RECT_ID);
  console.log(documentRectangle);
  const editableObjects = canvas
    .getObjects()
    .filter((obj) => obj.id !== BACKGROUND_RECT_ID);
  for (const object of editableObjects) {
    setEditableObjectProperties(object);
  }
  openedFilename = loadedData.openedFileName;
  console.log(canvas.getObjects());

  initializeCanvas();
}

async function createNewCanvas() {
  documentRectangle = new Rect({
    id: BACKGROUND_RECT_ID,
    fill: "white",
    width: DEFAULT_DOC_WIDTH,
    height: DEFAULT_DOC_HEIGHT,

    stroke: "#4B624C",
    strokeWidth: 0,
    selectable: false,
    hasControls: false,
    hoverCursor: "default",
  });

  canvas.add(documentRectangle);
  canvas.centerObject(documentRectangle);
  canvas.clipPath = documentRectangle;
}

function onDocEdit() {
  // TODO: Implement:
  // - mark dirty
  // - add to history
  // console.log('SAVIN');
  // clearTimeout(autosaveTimer);
  // if (idleCallback !== null) {
  //   cancelIdleCallback(idleCallback);
  // }
  // idleCallback = requestIdleCallback(() => {
  //   console.log('oop', performance.now());
  //   const data = {
  //     ppi,
  //     canvasData: canvas.toObject(PROPERTIES_TO_INCLUDE),
  //   };
  //   console.log('after', performance.now());
  //   window.electronAPI.saveSnapshot(data);
  // });
}

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
  let scale = util.findScaleToFit(documentRectangle, canvas) * 0.9; // TODO: fix eyeballing
  // const strokeWidth = Math.round(DEFAULT_DOC_BORDER_SIZE_IN_PIXELS / scale);
  // doc.strokeWidth = strokeWidth;

  // HACK: TODO: This is done so that zoom level is preserved on resize. Proper
  // fix would be to call a special init method for first time canvas dimension setting,
  // and then have a different method for window resizes.
  if (canvas.getZoom() !== 1) {
    scale = canvas.getZoom();
  }
  // END HACK

  canvas.zoomToPoint(center, scale);
  setCenterFromObject(documentRectangle);
  canvas.requestRenderAll();
}

function redoClone(toClone: Canvas) {
  const canvas = toClone.cloneWithoutData();
  const json = toClone.toObject(PROPERTIES_TO_INCLUDE);
  return canvas.loadFromJSON(json);
}

const paperSettingsButton = document.getElementById("settings");
paperSettingsButton.addEventListener("click", () => {
  if (paperSettingsBox.hidden) {
    disableSettingsBoxFor(canvas.getActiveObject());
    enablePaperSettingsBox();
  } else {
    disablePaperSettingsBox();
  }
});

const saveButton = document.getElementById("save-canvas");
saveButton.addEventListener("click", async () => {
  if (!openedFilename) {
    const result = await window.electronAPI.startNewSaveFile();
    if (!result || result.canceled) {
      // save cancelled
      return;
    }
    openedFilename = result.fileName;
  }

  const data = {
    ppi,
    canvasData: canvas.toObject(PROPERTIES_TO_INCLUDE),
  };
  const saveResult = await window.electronAPI.saveToFile(data);
  console.log("save", saveResult ? "succeeded" : "failed");
});

const loadButton = document.getElementById("load-canvas");
loadButton.addEventListener("click", async () => {
  const result = await window.electronAPI.loadSaveFile();
  if (!result) {
    return; // canceled
  }
  loadSnapshotData(result);

});

const newButton = document.getElementById("new-canvas");
newButton.addEventListener("click", async () => {});

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
  const { left, top, width, height } = documentRectangle;
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
  console.log("data url start", performance.now());
  const dataUrl = clonedCanvas.toDataURL(options);
  console.log("data url finished", performance.now());
  const dataUrlAdjustedDPI = changeDpiDataUrl(dataUrl, ppi);
  console.log("change dpi finished", performance.now());
  await window.electronAPI.downloadFile(dataUrlAdjustedDPI);
});

let altKeyPressed = false;

function onMouseWheel(opt) {
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

      canvas.requestRenderAll();
    } else {
      console.log(canvas.viewportTransform);
      // pan up and down

      const vpt = this.viewportTransform;
      vpt[5] -= delta;
      canvas.setViewportTransform(vpt);
      enclose(canvas, documentRectangle);
    }
  });
}

function onObjectAdded({target}) {
  enableSettingsBoxFor(target);
}

function onObjectModified() {
  onDocEdit();
}

function onObjectRemoved({target}) {
  disableSettingsBoxFor(target);
  onDocEdit();
}

function onObjectMoving({target}) {
  matchInputsToObjectValues(target);
}

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
    const activeObjects = canvas.getActiveObjects();
    console.log("get active elemnt", document.activeElement);
    // TODO: Kind of a hack to prevent deletions when editing the sidebar settings
    if (
      activeObjects.length === 0 ||
      document.activeElement.nodeName === "INPUT"
    ) {
      console.log("bye");
      return;
    }
    for (const object of activeObjects) {
      canvas.remove(object);
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
});

const addImageButton = document.getElementById("add-image");
addImageButton.addEventListener("click", async () => {
  console.log("hi");
  const base64 = await window.electronAPI.openFile();
  const url = `data:image/png;base64,${base64}`;
  addImageToCanvas(url);
});

async function addImageToCanvas(dataUrl) {
  const image = await FabricImage.fromURL(dataUrl);
  addFabricObjectToCanvas(image);
}

function setEditableObjectProperties(object: FabricObject) {
  object.set({
    transparentCorners: false,
    selectable: true,
  });
  object.setControlsVisibility({
    mt: false, // middle top disable
    mb: false, // midle bottom
    ml: false, // middle left
    mr: false,
  });
  object.snapAngle = 5;
}

async function onPaste(e: ClipboardEvent) {
  e.preventDefault();
  for (const item of e.clipboardData.items) {
    console.log(item);
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (!file) {
        continue;
      }
      const objectUrl = URL.createObjectURL(file);
      addImageToCanvas(objectUrl);
    } else if (item.type.startsWith("text/plain")) {
      console.log("hi", item);
      item.getAsString(async (text) => {
        try {
          const parsed = JSON.parse(text);
          if (!parsed.type) {
            return;
          }
          console.log("parsedType", parsed.type);
          if (parsed.type.toLowerCase() === "activeselection") {
            // We've got multiple items, so let's recreate the selection group
            const objects = await util.enlivenObjects<FabricObject>(
              parsed.objects
            );
            addObjectGroupToCanvas(objects);
          } else {
            const [object] = await util.enlivenObjects<FabricObject>([parsed]);
            if (!object) {
              return;
            }
            addFabricObjectToCanvas(object);
          }
        } catch {}
      });
    }
  }
}

function addFabricObjectToCanvas(object: FabricObject) {
  setEditableObjectProperties(object);
  canvas.add(object);
  canvas.bringObjectToFront(object);
  canvas.viewportCenterObject(object);
  canvas.setActiveObject(object);
  canvas.requestRenderAll();
  onDocEdit();
}

function addObjectGroupToCanvas(objects: Array<FabricObject>) {
  for (const object of objects) {
    setEditableObjectProperties(object);
    canvas.add(object);
    canvas.bringObjectToFront(object);
  }
  const sel = new ActiveSelection(objects);
  canvas.setActiveObject(sel);
  canvas.viewportCenterObject(sel);
  canvas.requestRenderAll();
  onDocEdit();
}

function handleLocalCopy() {
  console.log("plumbed");
  const activeObject = canvas.getActiveObject();
  if (!activeObject) {
    return;
  }
  const objectAsJson = JSON.stringify(
    activeObject.toObject(PROPERTIES_TO_INCLUDE)
  );
  return navigator.clipboard.writeText(objectAsJson);
}

/******
 *
 *
 * from https://github.com/fabricjs/fabric.js/discussions/7052
 */

// create Fabric canvas

let isDragging = false;
let lastPosX: any = null;
let lastPosY: any = null;

function enclose(canvas: Canvas, object: Rect) {
  console.log("ENCLOSE CALLED");
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

function onMouseDown(opt: TPointerEventInfo) {
  disablePaperSettingsBox();
  console.log("clicked ", opt.target);
  // Ignore clicks on doc or objects
  if (opt.target !== undefined) {
    if (opt.target.selectable) {
      enableSettingsBoxFor(opt.target);
    }
    return false;
  }

  canvas.setCursor("grabbing");

  const { e } = opt;
  const { clientX, clientY } = getClientPosition(e);

  isDragging = true;
  lastPosX = clientX;
  lastPosY = clientY;
  canvas.selection = false; // disable selection while grabbing
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
  enclose(canvas, documentRectangle);
  onDocEdit();
}

const settingsBox = document.getElementById("settings-box");
const imagePreview = document.getElementById("selected-object-preview");
const objectWidthInput = document.getElementById(
  "input-object-width"
) as HTMLInputElement;
const objectHeightInput = document.getElementById(
  "input-object-height"
) as HTMLInputElement;
const objectXInput = document.getElementById(
  "input-object-x"
) as HTMLInputElement;
const objectYInput = document.getElementById(
  "input-object-y"
) as HTMLInputElement;

// TODO: make this a little more elegant
let activeInputController = new AbortController();

function onMouseUp(opt: TPointerEventInfo) {
  isDragging = false;
  canvas.selection = true; // reenable selection after grab
  if (
    !settingsBox.hidden &&
    (opt.target === undefined ||
      opt.target === documentRectangle ||
      !opt.target.selectable)
  ) {
    disableSettingsBoxFor(opt.target);
  } else if (canvas.getActiveObject()) {
    enableSettingsBoxFor(canvas.getActiveObject());
  }
}

function matchInputsToObjectValues(object: FabricObject) {
  objectWidthInput.value = getScaledWidthInInches(object);
  objectHeightInput.value = getScaledHeightInInches(object);
  objectXInput.value = getObjectXInInches(object);
  objectYInput.value = getObjectYInInches(object);
}

function createImagePreviewSrc(object: FabricObject) {
  const offscreenCanvas = document.createElement("canvas");
  const ctx = offscreenCanvas.getContext("2d");
  offscreenCanvas.width = (200 / object.height) * object.width;
  offscreenCanvas.height = 200;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    object.toCanvasElement(),
    0,
    0,
    offscreenCanvas.width,
    offscreenCanvas.height
  );
  return offscreenCanvas.toDataURL();
}

const paperSettingsBox = document.getElementById("paper-settings-box");
const paperWidthInput = document.getElementById(
  "input-paper-width"
) as HTMLInputElement;
const paperHeightInput = document.getElementById(
  "input-paper-height"
) as HTMLInputElement;
const paperPpiInput = document.getElementById(
  "input-paper-ppi"
) as HTMLInputElement;

function setInitialPaperValues() {
  paperPpiInput.value = `${ppi}`;
  paperHeightInput.value = `${documentRectangle.height / ppi}`;
  paperWidthInput.value = `${documentRectangle.width / ppi}`;
}

paperWidthInput.addEventListener("input", () => {
  try {
    const value = parseFloat(paperWidthInput.value) * ppi;
    if (value) {
      documentRectangle.width = value;
      canvas.clipPath = documentRectangle;
      onDocEdit();
      canvas.requestRenderAll();
    } else {
      throw new Error(`invalid value ${value}`);
    }
  } catch (e) {
    console.log(e);
    // objectWidthInput.value = DEFAULT_WIDTH_IN_INCHES + "";
  }
});

paperHeightInput.addEventListener("input", () => {
  try {
    const value = parseFloat(paperHeightInput.value) * ppi;
    if (value) {
      documentRectangle.height = value;
      canvas.clipPath = documentRectangle;
      onDocEdit();
      canvas.requestRenderAll();
    } else {
      throw new Error(`invalid value ${value}`);
    }
  } catch (e) {
    console.log(e);
    // paperHeightInput.value = DEFAULT_HEIGHT_IN_INCHES + "";
  }
});

paperPpiInput.addEventListener("input", () => {
  try {
    const value = parseFloat(paperPpiInput.value);
    if (value) {
      const oldDocWidthInInches = documentRectangle.width / ppi;
      const oldDocHeightInInches = documentRectangle.height / ppi;
      ppi = value;
      documentRectangle.width = oldDocWidthInInches * ppi;
      documentRectangle.height = oldDocHeightInInches * ppi;
      canvas.clipPath = documentRectangle;
      onDocEdit();
      canvas.requestRenderAll();
    } else {
      throw new Error(`invalid value ${value}`);
    }
  } catch (e) {
    console.log(e);
    // paperHeightInput.value = DEFAULT_PPI + "";
  }
});

function enablePaperSettingsBox() {
  paperSettingsBox.hidden = false;
  // canvas.getActiveObject();
}

function disablePaperSettingsBox() {
  paperSettingsBox.hidden = true;
}

function enableSettingsBoxFor(object: FabricObject) {
  disablePaperSettingsBox();
  // Set initial values
  matchInputsToObjectValues(object);
  activeInputController = new AbortController();
  const { signal } = activeInputController;

  imagePreview.src = createImagePreviewSrc(object);

  // Add event listeners for inputs
  objectWidthInput.addEventListener(
    "input",
    (e) => {
      setScaledWidth(object, e.currentTarget.value);
    },
    { signal }
  );
  objectHeightInput.addEventListener(
    "input",
    (e) => {
      setScaledHeight(object, e.currentTarget.value);
    },
    { signal }
  );
  objectXInput.addEventListener(
    "input",
    (e) => {
      setObjectX(object, e.currentTarget.value);
    },
    { signal }
  );
  objectYInput.addEventListener(
    "input",
    (e) => {
      setObjectY(object, e.currentTarget.value);
    },
    { signal }
  );
  settingsBox.hidden = false;
}

function disableSettingsBoxFor(object: FabricObject) {
  activeInputController.abort();
  canvas.discardActiveObject();
  settingsBox.hidden = true;
}

function setScaledWidth(object: FabricObject, newWidthInput: string) {
  try {
    const value = parseFloat(newWidthInput) * ppi;
    if (value) {
      object.scaleToWidth(value);
      objectHeightInput.value = getScaledHeightInInches(object);
      canvas.requestRenderAll();
    } else {
      throw new Error(`invalid value ${value}`);
    }
  } catch (e) {
    console.log(e);
    objectWidthInput.value = getScaledWidthInInches(object);
  }
}

function setScaledHeight(object: FabricObject, newHeightInput: string) {
  try {
    const value = parseFloat(newHeightInput) * ppi;
    if (value) {
      object.scaleToHeight(value);
      objectWidthInput.value = getScaledWidthInInches(object);
      canvas.requestRenderAll();
    } else {
      throw new Error(`invalid value ${value}`);
    }
  } catch (e) {
    console.log(e);
    objectHeightInput.value = getScaledHeightInInches(object);
  }
}

function setObjectX(object: FabricObject, newXInput: string) {
  const topLeftOrigin = documentRectangle.aCoords.tl;
  try {
    const value = parseFloat(newXInput) * ppi + topLeftOrigin.x;
    if (value) {
      console.log("value is", value);
      object.setX(value);
      canvas.requestRenderAll();
    }
  } catch (e) {
    console.log(e);
    objectXInput.value = getObjectXInInches(object);
  }
}

function setObjectY(object: FabricObject, newYInput: string) {
  const topLeftOrigin = documentRectangle.aCoords.tl;
  try {
    const value = parseFloat(newYInput) * ppi + topLeftOrigin.y;
    if (value) {
      console.log("value is", value);
      object.setY(value);
      canvas.requestRenderAll();
    }
  } catch (e) {
    console.log(e);
    objectYInput.value = getObjectYInInches(object);
  }
}

function getScaledWidthInInches(object: FabricObject) {
  return (object.getScaledWidth() / ppi).toFixed(3);
}

function getScaledHeightInInches(object: FabricObject) {
  return (object.getScaledHeight() / ppi).toFixed(3);
}

function getObjectXInInches(object: FabricObject) {
  const topLeftOrigin = documentRectangle.aCoords.tl;
  const objectTopLeft = object.aCoords.tl;
  const xInPixels = objectTopLeft.x - topLeftOrigin.x;
  return (xInPixels / ppi).toFixed(3);
}

function getObjectYInInches(object: FabricObject) {
  const topLeftOrigin = documentRectangle.aCoords.tl;
  const objectTopLeft = object.aCoords.tl;
  const yInPixels = objectTopLeft.y - topLeftOrigin.y;
  return (yInPixels / ppi).toFixed(3);
}
