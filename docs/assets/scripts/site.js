const root = document.documentElement;
const themeButton = document.getElementById('themeToggle');
const commandsContainer = document.getElementById('commandsList');
const commandsUpdatedAt = document.getElementById('commandsUpdatedAt');

function setTheme(mode) {
  if (mode === 'dark') {
    root.classList.add('dark');
    if (themeButton) themeButton.textContent = '☀️';
  } else {
    root.classList.remove('dark');
    if (themeButton) themeButton.textContent = '🌙';
  }
  localStorage.setItem('memstar-theme', mode);
}

function initTheme() {
  const saved = localStorage.getItem('memstar-theme');
  if (saved) setTheme(saved);
  else setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  if (themeButton) {
    themeButton.addEventListener('click', () => {
      setTheme(root.classList.contains('dark') ? 'light' : 'dark');
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCommands(data) {
  if (!commandsContainer) return;

  const categories = Array.isArray(data.categories) ? data.categories : [];
  if (!categories.length) {
    commandsContainer.innerHTML = '<p class="muted">No commands available right now.</p>';
    return;
  }

  commandsContainer.innerHTML = categories
    .map((category) => {
      const categoryName = escapeHtml(category.name || 'Other');
      const commands = Array.isArray(category.commands) ? category.commands : [];

      const cards = commands
        .map((command) => {
          const name = escapeHtml(command.name || '/unknown');
          const description = escapeHtml(command.description || 'No description provided.');
          return `<article class="command-card"><h3>${name}</h3><p>${description}</p></article>`;
        })
        .join('');

      return `<section class="category"><h2>${categoryName}</h2><div class="commands-grid">${cards}</div></section>`;
    })
    .join('');

  if (commandsUpdatedAt && data.updatedAt) {
    const updatedAt = new Date(data.updatedAt);
    if (!Number.isNaN(updatedAt.getTime())) {
      commandsUpdatedAt.textContent = `Last updated: ${updatedAt.toLocaleString()}`;
    }
  }
}

async function loadCommands() {
  if (!commandsContainer) return;

  try {
    const response = await fetch('./data/commands.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Commands endpoint request failed');
    const data = await response.json();
    renderCommands(data);
  } catch (error) {
    if (commandsUpdatedAt) commandsUpdatedAt.textContent = 'Could not load commands.';
    commandsContainer.innerHTML = '<p class="muted">Could not load commands right now.</p>';
  }
}

initTheme();
loadCommands();
