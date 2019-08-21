/**
 * Build status widget.
 */

const statusIcons = new Map<string, string>([
  ['Unknown', '?'],
  ['Dirty', '\u22ef'],
  ['Building', '\u21ba'],
  ['Clean', '\u2714'],
  ['Failed', '\u2718'],
]);

function setText(parent: HTMLElement, text: string): void {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
  parent.appendChild(document.createTextNode(text));
}

const statusbox = document.getElementById('statusbox');
const statusicon = document.getElementById('statusicon');
const statustext = document.getElementById('statustext');

export function setBuildStatus(status: string) {
  let icon = statusIcons.get(status);
  if (!icon) {
    console.error(`Unknown status: ${JSON.stringify(status)}`);
    icon = '?';
    status = 'Unknown';
  }
  if (statusbox) {
    statusbox.className = `status-${status.toLowerCase()}`;
  }
  if (statusicon) {
    setText(statusicon, icon);
  }
  if (statustext) {
    setText(statustext, status);
  }
}
