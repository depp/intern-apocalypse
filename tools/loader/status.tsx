/**
 * Build status widget.
 */

import * as React from 'react';
import { render } from 'react-dom';

const statusIcons = new Map<string, string>([
  ['Unknown', '?'],
  ['Dirty', '\u22ef'],
  ['Building', '\u21ba'],
  ['Clean', '\u2714'],
  ['Failed', '\u2718'],
]);

/**
 * Component that displays the current build status.
 */
function statusIcon(status: string) {
  return (
    <div className={'status-' + status.toLocaleLowerCase()}>
      <p id="statusicon">{statusIcons.get(status)}</p>
      <p id="statustext">{status}</p>
    </div>
  );
}

const statusbox = document.getElementById('statusbox');

export function setBuildStatus(status: string) {
  if (!statusIcons.has(status)) {
    status = 'unknown';
  }
  render(statusIcon(status), statusbox);
}

setBuildStatus('Unknown');
