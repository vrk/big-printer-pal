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

import './css/index.css';

console.log('👋 This message is being logged by "renderer.ts", included via Vite');


import { Canvas } from 'fabric'; // browser

const canvas = new Canvas('html-canvas');
const DEFAULT_PPI = 300;
const DEFAULT_WIDTH_IN_INCHES = 8.5;
const DEFAULT_HEIGHT_IN_INCHES = 11;

let ppi = DEFAULT_PPI;
let docWidth = DEFAULT_WIDTH_IN_INCHES * ppi;
let docHeight = DEFAULT_HEIGHT_IN_INCHES * ppi;

const overallContainer = document.getElementById('fabric-canvas-container');

//  edit from here
canvas.setDimensions({
  width: overallContainer.offsetWidth,
  height: overallContainer.offsetHeight,
});
