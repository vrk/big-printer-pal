import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import SimpleElectronStore from "./simple-store";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const isMac = process.platform === "darwin";
const LAST_SAVED_FILE_PATH_KEY = "__last_opened_file__";

function buildMenu(mainWindow) {
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    // { role: 'fileMenu' }
    {
      label: "File",
      submenu: [
        {
          // role: "halp",
          label: "Save",
          accelerator: "CommandOrControl+S",
          click: () => {
            onMenuSave(mainWindow)
          }
        },
        {
          // role: "halp",
          label: "Load",
          accelerator: "CommandOrControl+O",
          click: () => {
            onMenuLoad(mainWindow)
          }
        },
        isMac ? { role: "close" } : { role: "quit" }
      ],
    },
    // { role: 'editMenu' }
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        {
          // role: "halp",
          label: "Copy",
          accelerator: "CommandOrControl+C",
          click: () => {
            console.log("Electron rocks!");
            mainWindow.webContents.send('system:local-copy');
          },
        },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" },
              { role: "delete" },
              { role: "selectAll" },
              { type: "separator" },
              {
                label: "Speech",
                submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
              },
            ]
          : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
      ],
    },
    // { role: 'viewMenu' }
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        // { type: 'separator' },
        // { role: 'resetZoom' },
        // { role: 'zoomIn' },
        // { role: 'zoomOut' },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // { role: 'windowMenu' }
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { role: "front" },
              { type: "separator" },
              { role: "window" },
            ]
          : [{ role: "close" }]),
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal("https://electronjs.org");
          },
        },
      ],
    },
  ];
  return template;
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.maximize();
  const template = buildMenu(mainWindow);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.webContents.on("did-finish-load", () => {
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
    mainWindow.show();
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const store = new SimpleElectronStore();

app.whenReady().then(() => {
  ipcMain.handle("dialog:openFile", handleFileOpen);
  ipcMain.handle("dialog:downloadFile", handleFileDownload);
  ipcMain.handle("dialog:createNewUnsavedFile", handleNewFile);
  ipcMain.handle("dialog:createNewSaveFile", handleNewSaveFile);
  ipcMain.handle("dialog:loadSaveFile", handleLoadData);
  ipcMain.handle("dialog:loadLastSaveFile", handleLoadLastSaveIfAny);
  ipcMain.handle("dialog:saveFile", handleSaveData);
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const SNAPSHOT_KEY = "__snapshot-key__";

let saveFilePath : string | null = null;

async function onMenuSave(mainWindow) {
  if (!saveFilePath) {
    const result = await handleNewSaveFile();
    if (result.canceled) {
      return;
    }
  }
  console.log(saveFilePath);

  mainWindow.webContents.send('system:save-canvas', path.basename(saveFilePath));
}

async function onMenuLoad(mainWindow) {
  const loadData = await handleLoadData();
  if (!loadData) {
    return;
  }
  mainWindow.webContents.send('system:load-canvas', loadData);
}

async function handleNewFile() {
  store.delete(LAST_SAVED_FILE_PATH_KEY);
  saveFilePath = null;
}

async function handleNewSaveFile() {
  const options = {
    title: "Save file",
    defaultPath: "printable.json",
    buttonLabel: "Save",

    filters: [
      { name: "json", extensions: ["json"] },
      { name: "All Files", extensions: ["*"] },
    ],
  };
  const {canceled, filePath} = await dialog.showSaveDialog(null, options);
  if (!canceled) {
    saveFilePath = filePath;
  }
  return { canceled, openedFileName: path.basename(filePath) };
}

async function handleSaveData(_: any, data: Object) {
  if (!saveFilePath) {
    return false;
  }
  fs.writeFileSync(saveFilePath, JSON.stringify(data));
  store.set(LAST_SAVED_FILE_PATH_KEY, saveFilePath);
  return true;
}

async function handleLoadLastSaveIfAny(_: any) {
  const lastFileOpen = store.get(LAST_SAVED_FILE_PATH_KEY);
  if (!lastFileOpen) {
    return null;
  }
  saveFilePath = lastFileOpen;
  return loadSaveFileFromDisk(saveFilePath);
}

async function handleLoadData() {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Documents", extensions: ["json"] }, { name: "All Files", extensions: ["*"] }],
  });

  const { canceled, filePaths } = result;
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return loadSaveFileFromDisk(filePaths[0])
}

async function loadSaveFileFromDisk(filePath) {
  try {
    const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    store.set(LAST_SAVED_FILE_PATH_KEY, filePath);
    saveFilePath = filePath;
    return {
      snapshot,
      openedFileName: path.basename(filePath)
    };
  } catch (e) {
    console.log(e);
    store.delete(LAST_SAVED_FILE_PATH_KEY);
    return null;
  }

}

async function handleFileOpen() {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
  });

  const { canceled, filePaths } = result;
  if (canceled) {
    return null;
  }
  const fileData = await fs.promises.readFile(filePaths[0]);
  const base64 = fileData.toString("base64");
  return base64;
}

async function handleFileDownload(_: any, dataUrl: string) {
  var options = {
    title: "Download print file",
    defaultPath: "printable-file.png",
    buttonLabel: "Save",

    filters: [
      { name: "PNG image", extensions: ["png"] },
      { name: "All Files", extensions: ["*"] },
    ],
  };
  dialog.showSaveDialog(null, options).then(({ filePath }) => {
    console.log("start", performance.now());
    var data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    var buf = Buffer.from(data, "base64");

    fs.writeFile(filePath, buf, () => {
      console.log("end", performance.now());
    });
  });
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
