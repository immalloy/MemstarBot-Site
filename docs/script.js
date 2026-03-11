const root = document.documentElement;
const btn = document.getElementById('themeToggle');

function setTheme(mode) {
  if (mode === 'dark') {
    root.classList.add('dark');
    btn.textContent = '☀️';
  } else {
    root.classList.remove('dark');
    btn.textContent = '🌙';
  }
  localStorage.setItem('memstar-theme', mode);
}

const saved = localStorage.getItem('memstar-theme');
if (saved) setTheme(saved);
else setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

btn.addEventListener('click', () => {
  setTheme(root.classList.contains('dark') ? 'light' : 'dark');
});
