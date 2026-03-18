// Rework inspired by antigravity.google and Bramus' modern CSS article.
// This script wires Houdini ring-particles and pointer-follow behavior.

const root = document.documentElement;
const welcome = document.getElementById('welcome');
const themeToggle = document.getElementById('themeToggle');

if ('paintWorklet' in CSS) {
  CSS.paintWorklet
    .addModule('https://unpkg.com/css-houdini-ringparticles/dist/ringparticles.js')
    .catch((err) => {
      console.warn('[ring-particles] Failed to load worklet module:', err);
    });
}

function setRingPointer(clientX, clientY, interactive) {
  const x = (clientX / window.innerWidth) * 100;
  const y = (clientY / window.innerHeight) * 100;
  welcome.style.setProperty('--ring-x', String(Math.max(0, Math.min(100, x))));
  welcome.style.setProperty('--ring-y', String(Math.max(0, Math.min(100, y))));
  welcome.style.setProperty('--ring-interactive', interactive ? '1' : '0');
}

welcome.addEventListener('pointermove', (e) => {
  welcome.classList.add('interactive');
  setRingPointer(e.clientX, e.clientY, true);
});

welcome.addEventListener('pointerleave', () => {
  welcome.classList.remove('interactive');
  welcome.style.setProperty('--ring-x', '50');
  welcome.style.setProperty('--ring-y', '50');
  welcome.style.setProperty('--ring-interactive', '0');
});

welcome.style.setProperty('--ring-x', '50');
welcome.style.setProperty('--ring-y', '50');
welcome.style.setProperty('--ring-interactive', '0');

function applyTheme(nextTheme) {
  root.setAttribute('data-theme', nextTheme);
}

themeToggle.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});
