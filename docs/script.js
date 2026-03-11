const root = document.documentElement;
const btn = document.getElementById('themeToggle');
const commandsList = document.getElementById('commandsList');

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

if (btn) {
  btn.addEventListener('click', () => {
    setTheme(root.classList.contains('dark') ? 'light' : 'dark');
  });
}

async function loadCommands() {
  if (!commandsList) return;

  try {
    const response = await fetch('./commands.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to fetch commands.');

    const commands = await response.json();
    if (!Array.isArray(commands)) throw new Error('Invalid commands format.');

    commandsList.innerHTML = commands
      .map((command) => {
        const name = command.name || 'unknown';
        const description = command.description || 'No description provided.';
        const usage = command.usage || `/${name}`;

        return `<article class="command-card"><h2>/${name}</h2><p>${description}</p><code>${usage}</code></article>`;
      })
      .join('');
  } catch (error) {
    commandsList.innerHTML = '<p class="muted">Could not load commands right now.</p>';
  }
}

loadCommands();
