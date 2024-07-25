import { Canvas, BasicTransformEvent, Transform, util, FabricObject} from "fabric";

type ModificationType = 'addObject' | 'removeObject' | 'modifyObject' | 'changePPI';

type HistoryAction = {
  type: ModificationType;

  // TODO do this better

  /** The ID of the object this refers to. Used for addObject and modifyObject. */
  objectID?: string;

  /** Copy of the newly delete object. Used for removeObject. */
  objectDeepCopy?: string;

  /** Copy of the properties it used to have before the modification. Used for modifyObject */
  previousProperties?: any;

}

const PROPERTIES_TO_INCLUDE = [
  "id",
  "selectable",
  "hasControls",
  "hoverCursor",
  "transparentCorners",
];
class FabricHistory {
  private historyUndo: Array<HistoryAction> = [];
  private historyRedo: Array<HistoryAction> = [];
  private historyProcessing = false;
  private canvas: Canvas;
  private static get EXTRA_PROPS():Array<string> { return ['selectable', 'editable'] }
  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.canvas.on(this.getHistoryEvents());
  }

  clearHistory() {
    this.historyUndo = [];
    this.historyRedo = [];
  }

  removeListeners() {
    this.canvas.off(this.getHistoryEvents());
    this.historyUndo = [];
    this.historyRedo = [];
  }

  private historySaveAddObject(objectEvent: any) {
    if (this.historyProcessing) return;
    this.historyRedo = [];

    // TODO: handle multi select
    const action: HistoryAction = {
      type: 'addObject',
      objectID: objectEvent.target.id
    }
    this.historyUndo.push(action);
  }

  private historySaveRemoveObject(objectEvent: any) {
    if (this.historyProcessing) return;
    this.historyRedo = [];
    const object = objectEvent.target as FabricObject;

    const action: HistoryAction = {
      type: 'removeObject',
      objectDeepCopy: JSON.stringify(object.toObject(PROPERTIES_TO_INCLUDE))
    }
    this.historyUndo.push(action);
  }

  private historyModifyObjection(objectEvent: any) {
    if (this.historyProcessing) return;
    this.historyRedo = [];
    console.log(objectEvent);
    const transform = objectEvent.transform as Transform;

    const action: HistoryAction = {
      type: 'modifyObject',
      objectID: objectEvent.target.id,
      previousProperties: {
        ...transform.original
      }
    }

    this.historyUndo.push(action);
  }

  private getHistoryEvents():Object {
    return {
      'object:added': (e: any) => this.historySaveAddObject(e),
      'object:removed': (e: any) => this.historySaveRemoveObject(e),
      'object:modified': (e: any) => this.historyModifyObjection(e),
    };
  }

  async redo() {
    this.canvas.discardActiveObject();
    if (this.historyRedo.length === 0) {
      return;
    }

    const actionToRedo  = this.historyRedo.pop();

    // And then redo that last action
    this.historyProcessing = true;
    switch(actionToRedo.type) {
      case "addObject":
        // redo add object -> add
        if (!actionToRedo.objectDeepCopy) {
          console.error('could not redo action', actionToRedo);
          return;
        }
        const [ object ] = await util.enlivenObjects([JSON.parse(actionToRedo.objectDeepCopy)]);
        const restoredObject = object as FabricObject;
    
        this.historyUndo.push({
          type: 'addObject',
          objectID: restoredObject.id
        });
        setEditableObjectProperties(restoredObject);
        this.canvas.add(restoredObject);
        break;
      case "removeObject": {
        // redo remove object -> remove
        if (!actionToRedo.objectID) {
          console.error('could not redo action', actionToRedo);
          return;
        }
        const found = this.canvas.getObjects().find((o) => { return o.id === actionToRedo.objectID})
        this.historyUndo.push({
          type: 'removeObject',
          objectDeepCopy: JSON.stringify(found.toObject(PROPERTIES_TO_INCLUDE))
        })
        this.canvas.remove(found);
        break;

      }
      case "modifyObject": {
        if (!actionToRedo.objectID || !actionToRedo.previousProperties) {
          console.error('could not redo action', actionToRedo);
          return;
        }
        const currentProperties: any = {};
        const found = this.canvas.getObjects().find((o) => { return o.id === actionToRedo.objectID})
        for (const entry of Object.entries(actionToRedo.previousProperties)) {
          const [key] = entry;
          currentProperties[key] = found.get(key)
        }
        this.historyUndo.push({
          type: 'modifyObject',
          objectID: actionToRedo.objectID,
          previousProperties: currentProperties
        })
        for (const entry of Object.entries(actionToRedo.previousProperties)) {
          const [key, value] = entry;
          found.set(key, value)
          found.setCoords();
        }
        break;
      }case "changePPI":
        return;
    }

    this.canvas.requestRenderAll();
    this.historyProcessing = false;
  }

  async undo() {
    this.canvas.discardActiveObject();
    console.log(this.canvas.getObjects())
    if (this.historyUndo.length === 0) {
      return;
    }
    const actionToUndo = this.historyUndo.pop();

    this.historyProcessing = true;

        console.log('undo', actionToUndo)
    switch (actionToUndo.type) {
      case "addObject":
        // undo add object -> remove
        if (!actionToUndo.objectID) {
          console.error('could not undo action', actionToUndo);
          return;
        }
        const found = this.canvas.getObjects().find((o) => { return o.id === actionToUndo.objectID})
        this.historyRedo.push({
          type: 'addObject',
          objectDeepCopy: JSON.stringify(found.toObject(PROPERTIES_TO_INCLUDE))
        })
        this.canvas.remove(found);
        break;
      case "removeObject":
        // undo remove object -> add
        if (!actionToUndo.objectDeepCopy) {
          console.error('could not undo action', actionToUndo);
          return;
        }
        const [ object ] = await util.enlivenObjects([JSON.parse(actionToUndo.objectDeepCopy)]);
        const restoredObject = object as FabricObject;
    
        this.historyRedo.push({
          type: 'removeObject',
          objectID: restoredObject.id
        });
        setEditableObjectProperties(restoredObject);
        this.canvas.add(restoredObject);
        break;
      case "modifyObject": {
        if (!actionToUndo.objectID || !actionToUndo.previousProperties) {
          console.error('could not undo action', actionToUndo);
          return;
        }
        const found = this.canvas.getObjects().find((o) => { return o.id === actionToUndo.objectID})
        console.log(found);
        const currentProperties: any = {};
        for (const entry of Object.entries(actionToUndo.previousProperties)) {
          const [key] = entry;
          currentProperties[key] = found.get(key)
        }
        this.historyRedo.push({
          type: 'modifyObject',
          objectID: actionToUndo.objectID,
          previousProperties: currentProperties
        })
        for (const entry of Object.entries(actionToUndo.previousProperties)) {
          const [key, value] = entry;
          found.set(key, value)
          found.setCoords();
        }
        break;
      } case "changePPI":
        break;
    }
    this.historyProcessing = false;
    this.canvas.requestRenderAll();
  }
  
}


// TODO: CONSOLIDATE

function setEditableObjectProperties(object: FabricObject) {
  console.log('EDITABLEPROPERTIES')
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
export default FabricHistory;