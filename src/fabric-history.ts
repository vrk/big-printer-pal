import { Canvas, BasicTransformEvent, Transform, util, FabricObject} from "fabric";

type ModificationType = 'addObject' | 'removeObject' | 'modifyObject' | 'changePPI';

type HistoryAction = {
  type: ModificationType;

  // TODO do this better

  /** Reference to the live object. Used for addObject and modifyObject. */
  objectReference?: FabricObject;

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

    // TODO: handle multi select
    const action: HistoryAction = {
      type: 'addObject',
      objectReference: objectEvent.target
    }
    this.historyUndo.push(action);
  }

  private historySaveRemoveObject(objectEvent: any) {
    if (this.historyProcessing) return;
    const object = objectEvent.target as FabricObject;

    const action: HistoryAction = {
      type: 'removeObject',
      objectDeepCopy: JSON.stringify(object.toObject(PROPERTIES_TO_INCLUDE))
    }
    this.historyUndo.push(action);
  }

  private historyModifyObjection(objectEvent: any) {
    if (this.historyProcessing) return;
    console.log(objectEvent);
    const transform = objectEvent.transform as Transform;

    const action: HistoryAction = {
      type: 'modifyObject',
      objectReference: objectEvent.target,
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
    if (this.historyRedo.length === 0) {
      return;
    }

    const stateToRestoreTo = this.historyRedo.pop();
    this.historyUndo.push(stateToRestoreTo);

    // And then redo that last action
    this.historyProcessing = true;
    switch(stateToRestoreTo.type) {
      case "addObject":

      case "removeObject":
      case "modifyObject":
      case "changePPI":
        return;
    }

    this.historyProcessing = false;
  }

  async undo() {
    if (this.historyUndo.length === 0) {
      return;
    }
    const actionToUndo = this.historyUndo.pop();

    this.historyProcessing = true;

    switch (actionToUndo.type) {
      case "addObject":
        // undo add object -> remove
        if (!actionToUndo.objectReference) {
          console.error('could not undo action', actionToUndo);
          return;
        }
        this.historyRedo.push({
          type: 'addObject',
          objectDeepCopy: JSON.stringify(actionToUndo.objectReference.toObject(PROPERTIES_TO_INCLUDE))
        })
        this.canvas.remove(actionToUndo.objectReference);
        break;
      case "removeObject":
        // undo remove object -> add
        if (!actionToUndo.objectDeepCopy) {
          console.error('could not undo action', actionToUndo);
          return;
        }
        // const objectDeepCopy = JSON.parse(actionToUndo.objectDeepCopy) as FabricObject
        const [ object ] = await util.enlivenObjects([JSON.parse(actionToUndo.objectDeepCopy)]);
        const restoredObject = object as FabricObject;
    
        this.historyRedo.push({
          type: 'removeObject',
          objectReference: restoredObject
        });
        this.canvas.add(restoredObject);
        break;
      case "modifyObject":
        if (!actionToUndo.objectReference || !actionToUndo.previousProperties) {
          console.error('could not undo action', actionToUndo);
          return;
        }
        const currentProperties: any = {};
        for (const entry of Object.entries(actionToUndo.previousProperties)) {
          const [key] = entry;
          currentProperties[key] = actionToUndo.objectReference.get(key)
        }
        this.historyRedo.push({
          type: 'modifyObject',
          previousProperties: currentProperties
        })
        for (const entry of Object.entries(actionToUndo.previousProperties)) {
          const [key, value] = entry;
          actionToUndo.objectReference.set(key, value)
        }
        break;
      case "changePPI":
        break;
    }
    this.historyProcessing = false;
    this.canvas.requestRenderAll();
  }
  
}

export default FabricHistory;