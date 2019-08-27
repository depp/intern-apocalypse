/**
 * Loader WebSocket code.
 */

import { DataFile, updateFiles } from './debug.files';
import { setBuildStatus } from './debug.status';

/** An error when encountering a bad WebSocket message. */
class BadMessage extends Error {}

/** Handle a build status message. */
function handleStatusMessage(obj: any): void {
  const { status } = obj;
  if (typeof status != 'string') {
    throw new BadMessage('Missing build status');
  }
  setBuildStatus(status);
}

/** Handle a file contents message. */
function handleFilesMessage(obj: any): void {
  const { files } = obj;
  if (
    typeof files != 'object' ||
    !Array.isArray(files) ||
    (files.length & 1) != 0
  ) {
    throw new BadMessage('invalid files array');
  }
  const count = files.length / 2;
  const updates: DataFile[] = [];
  for (let i = 0; i < count; i++) {
    const name = files[i * 2];
    if (typeof name != 'string') {
      throw new BadMessage('invalid file name');
    }
    const data = files[i * 2 + 1];
    if (typeof data != 'string' && data !== null) {
      throw new BadMessage('invalid file data');
    }
    updates.push({ name, data, version: 0 });
  }
  updateFiles(updates);
}

/** Handle a WebSocket message event. */
function handleMessage(evt: MessageEvent): void {
  const { data } = evt;
  let obj: any;
  try {
    if (typeof data != 'string') {
      throw new BadMessage('Message is not a string');
    }
    const obj = JSON.parse(data);
    if (typeof obj != 'object') {
      throw new BadMessage('Message data is not an object');
    }
    const { type } = obj;
    if (typeof type != 'string') {
      throw new BadMessage('Missing message type');
    }
    switch (type) {
      case 'status':
        handleStatusMessage(obj);
        break;
      case 'files':
        handleFilesMessage(obj);
        break;
      default:
        throw new BadMessage('Unknown message type');
    }
  } catch (e) {
    if (e instanceof BadMessage) {
      if (obj !== undefined) {
        console.error(e.message, { obj });
      } else {
        console.error(e.message, { data });
      }
    }
  }
}

/**
 * Open the web socket for communicating with the build process.
 */
export function openWebSocket(): void {
  const ws = new WebSocket(`ws://${window.location.host}/`);
  ws.addEventListener('error', evt => {
    // FIXME: Retry.
    console.log('WebSocket Error:', evt);
    setBuildStatus('Unknown');
  });
  ws.addEventListener('open', evt => {
    console.log('WebSocket Open');
  });
  ws.addEventListener('close', evt => {
    // FIXME: Reconnect.
    console.log('WebSocket Closed', evt.code);
    setBuildStatus('Unknown');
  });
  ws.addEventListener('message', handleMessage);
}
