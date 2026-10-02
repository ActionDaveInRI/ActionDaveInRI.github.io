import { startGame } from './game.js';
const game = startGame(document.querySelector('#game'));
document.querySelector('#new-seed').addEventListener('click', () => game.newSeed());
for (const button of document.querySelectorAll('[data-input]')) {
  const key = button.dataset.input;
  button.addEventListener('pointerdown', event => {
    button.setPointerCapture(event.pointerId);
    game.input(key, true);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(event, () => game.input(key, false));
  }
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); game.input(key, true); }
  });
  button.addEventListener('keyup', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); game.input(key, false); }
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
}
window.addEventListener('pagehide', () => game.destroy());
