import { app, BrowserWindow, Menu, dialog, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import SimpleElectronStore from "./simple-store.js";

// // Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require("electron-squirrel-startup")) {
//   app.quit();
// }

const isMac = process.platform === "darwin";

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
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
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
      preload: path.join(import.meta.dirname, 'preload.js'),
      // nodeIntegrationInWorker: true
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
      path.join(import.meta.dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
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
  ipcMain.handle("autosave:saveSnapshot", handleSaveSnapshot);
  ipcMain.handle("autosave:loadSnapshot", handleLoadSnapshot);
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const SNAPSHOT_KEY = "__snapshot-key__";

async function handleSaveSnapshot(_: any, dataUrl: Object) {
  store.set(SNAPSHOT_KEY, dataUrl);
}

async function handleLoadSnapshot() {
  return store.get(SNAPSHOT_KEY);
}

async function handleFileOpen() {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
  });

  const { canceled, filePaths } = result;
  if (canceled) {
    return;
  }
  const fileData = await fs.promises.readFile(filePaths[0]);
  const base64 = fileData.toString("base64");
  return base64;
}

async function handleFileDownload(_: any, dataUrl: string) {
  var options = {
    title: "Save file",
    defaultPath: "printabl fe.png",
    buttonLabel: "Save",

    filters: [
      { name: "png", extensions: ["png"] },
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
