/**
 * Live reloading script.
 */

console.log('Live reload');

const ws = new WebSocket(`ws://${window.location.host}/`);
ws.addEventListener('error', evt => {
  console.log('Error:', evt);
});
ws.addEventListener('open', evt => {
  console.log('Open', evt);
});
ws.addEventListener('close', evt => {
  console.log('Closed', evt);
});
ws.addEventListener('message', evt => {
  console.log('Message', evt);
});
