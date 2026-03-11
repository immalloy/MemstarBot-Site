const root = document.documentElement;
const themeButton = document.getElementById('themeToggle');
const commandsContainer = document.getElementById('commandsList');
const commandsUpdatedAt = document.getElementById('commandsUpdatedAt');
const commandSearchInput = document.getElementById('commandSearch');
const commandsCount = document.getElementById('commandsCount');
const detailCategory = document.getElementById('detailCategory');
const detailName = document.getElementById('detailName');
const detailDescription = document.getElementById('detailDescription');
const detailUsage = document.getElementById('detailUsage');
const detailArgs = document.getElementById('detailArgs');

let allCommands = [];
let filteredCommands = [];
let selectedCommandId = null;
const COMMANDS_ENDPOINT = 'http://memstarbot.duckdns.org:8081/commands.json';

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

function formatLabel(token) {
  return token.replaceAll('_', ' ');
}

function inferHint(token) {
  if (token.endsWith('_ms')) return 'Milliseconds value';
  if (token.endsWith('_id')) return 'Identifier value';
  if (token.includes('window')) return 'Duration window';
  if (token.includes('cooldown')) return 'Cooldown duration';
  if (token.includes('amount')) return 'Numeric amount';
  if (token.includes('max')) return 'Maximum allowed value';
  return 'Argument value';
}

function parseCommandSignature(rawName) {
  const safeRaw = typeof rawName === 'string' ? rawName.trim() : '/unknown';
  const baseMatch = safeRaw.match(/^\/[a-zA-Z0-9_-]+/);
  const baseName = baseMatch ? baseMatch[0] : safeRaw.split(' ')[0] || '/unknown';

  const args = [];
  const argPattern = /([<\[])([^>\]]+)([>\]])/g;
  let match = argPattern.exec(safeRaw);
  while (match) {
    const open = match[1];
    const token = match[2].trim();
    const close = match[3];
    args.push({
      token,
      required: open === '<' && close === '>',
      label: formatLabel(token),
      hint: inferHint(token)
    });
    match = argPattern.exec(safeRaw);
  }

  return {
    rawName: safeRaw,
    baseName,
    args
  };
}

function buildCommandIndex(data) {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const results = [];

  for (const category of categories) {
    const categoryName = category && category.name ? category.name : 'Other';
    const commands = Array.isArray(category && category.commands) ? category.commands : [];

    for (const command of commands) {
      const signature = parseCommandSignature(command && command.name ? command.name : '/unknown');
      const description = command && command.description ? command.description : 'No description provided.';
      const id = `${categoryName}:${signature.rawName}`;

      results.push({
        id,
        categoryName,
        description,
        ...signature
      });
    }
  }

  return results;
}

function renderCommandDetail(command) {
  if (!detailName || !detailDescription || !detailUsage || !detailArgs || !detailCategory) return;
  if (!command) {
    detailCategory.textContent = 'Category';
    detailName.textContent = 'No matching command';
    detailDescription.textContent = 'Try a different search term.';
    detailUsage.textContent = '/command';
    detailArgs.innerHTML = '<p class="muted">No command selected.</p>';
    return;
  }

  detailCategory.textContent = command.categoryName;
  detailName.textContent = command.baseName;
  detailDescription.textContent = command.description;
  detailUsage.textContent = command.rawName;

  if (!command.args.length) {
    detailArgs.innerHTML = '<p class="muted">This command does not require arguments.</p>';
    return;
  }

  detailArgs.innerHTML = '';
  for (const arg of command.args) {
    const row = document.createElement('div');
    row.className = 'arg-item';

    const badge = document.createElement('span');
    badge.className = arg.required ? 'arg-badge required' : 'arg-badge optional';
    badge.textContent = arg.required ? 'Required' : 'Optional';

    const name = document.createElement('strong');
    name.textContent = arg.label;

    const hint = document.createElement('p');
    hint.className = 'muted arg-hint';
    hint.textContent = arg.hint;

    row.appendChild(badge);
    row.appendChild(name);
    row.appendChild(hint);
    detailArgs.appendChild(row);
  }
}

function setSelectedCommand(commandId) {
  selectedCommandId = commandId;
  renderCommandList();
  const command = filteredCommands.find((item) => item.id === commandId) || filteredCommands[0] || null;
  renderCommandDetail(command);
}

function renderCommandList() {
  if (!commandsContainer) return;

  commandsContainer.innerHTML = '';
  if (!filteredCommands.length) {
    commandsContainer.innerHTML = '<p class="muted">No commands matched your search.</p>';
    if (commandsCount) commandsCount.textContent = '0 commands shown';
    renderCommandDetail(null);
    return;
  }

  if (commandsCount) {
    const total = allCommands.length;
    const shown = filteredCommands.length;
    commandsCount.textContent = shown === total ? `${shown} commands` : `${shown} of ${total} commands`;
  }

  const fragment = document.createDocumentFragment();
  for (const command of filteredCommands) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'command-link';
    if (command.id === selectedCommandId) button.classList.add('active');
    button.textContent = command.baseName;
    button.addEventListener('click', () => setSelectedCommand(command.id));
    fragment.appendChild(button);
  }

  commandsContainer.appendChild(fragment);
}

function applyCommandFilter() {
  const term = commandSearchInput ? commandSearchInput.value.trim().toLowerCase() : '';
  filteredCommands = allCommands.filter((command) => {
    if (!term) return true;
    return (
      command.baseName.toLowerCase().includes(term)
      || command.rawName.toLowerCase().includes(term)
      || command.categoryName.toLowerCase().includes(term)
      || command.description.toLowerCase().includes(term)
      || command.args.some((arg) => arg.token.toLowerCase().includes(term) || arg.label.toLowerCase().includes(term))
    );
  });

  if (!filteredCommands.some((command) => command.id === selectedCommandId)) {
    selectedCommandId = filteredCommands.length ? filteredCommands[0].id : null;
  }

  renderCommandList();
  const selected = filteredCommands.find((item) => item.id === selectedCommandId) || null;
  renderCommandDetail(selected);
}

function renderCommands(data) {
  if (!commandsContainer) return;

  allCommands = buildCommandIndex(data);
  filteredCommands = [...allCommands];

  if (!allCommands.length) {
    commandsContainer.innerHTML = '<p class="muted">No commands available right now.</p>';
    if (commandsCount) commandsCount.textContent = '0 commands shown';
    renderCommandDetail(null);
    return;
  }

  selectedCommandId = allCommands[0].id;
  applyCommandFilter();

  if (commandSearchInput) {
    commandSearchInput.addEventListener('input', applyCommandFilter);
  }

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
    const cacheBustedUrl = `${COMMANDS_ENDPOINT}?t=${Date.now()}`;
    const response = await fetch(cacheBustedUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Commands endpoint request failed');
    const data = await response.json();
    renderCommands(data);
  } catch (error) {
    if (commandsUpdatedAt) commandsUpdatedAt.textContent = 'Could not load commands.';
    commandsContainer.innerHTML = '<p class="muted">Could not load commands right now.</p>';
    if (commandsCount) commandsCount.textContent = 'Could not load command index.';
  }
}

initTheme();
loadCommands();
