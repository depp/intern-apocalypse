/**
 * Loader WebSocket code.
 */

import { setBuildStatus } from './status';

/** An error when encountering a bad WebSocket message. */
class BadMessage extends Error {}

/** Handle a build status message. */
function handleStatusMessage(obj: any) {
  const { status } = obj;
  if (typeof status != 'string') {
    throw new BadMessage('Missing build status');
  }
  setBuildStatus(status);
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
  });
  ws.addEventListener('open', evt => {
    console.log('WebSocket Open');
  });
  ws.addEventListener('close', evt => {
    // FIXME: Reconnect.
    console.log('WebSocket Closed', evt.code);
  });
  ws.addEventListener('message', handleMessage);
}
