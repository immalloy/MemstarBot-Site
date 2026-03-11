const root = document.documentElement;
const themeButton = document.getElementById('themeToggle');
const commandsContainer = document.getElementById('commandsList');
const commandsUpdatedAt = document.getElementById('commandsUpdatedAt');
const commandSearchInput = document.getElementById('commandSearch');
const categoryFilter = document.getElementById('categoryFilter');
const clearSearchButton = document.getElementById('clearSearch');
const commandsCount = document.getElementById('commandsCount');
const detailCategory = document.getElementById('detailCategory');
const detailName = document.getElementById('detailName');
const detailDescription = document.getElementById('detailDescription');
const detailUsage = document.getElementById('detailUsage');
const copyUsageButton = document.getElementById('copyUsage');
const detailArgs = document.getElementById('detailArgs');
const detailNotes = document.getElementById('detailNotes');
const pinnedCommandName = document.getElementById('pinnedCommandName');
const pinnedCommandDescription = document.getElementById('pinnedCommandDescription');
const pinnedCommandAction = document.getElementById('pinnedCommandAction');

let allCommands = [];
let filteredCommands = [];
let selectedCommandId = null;
const COMMANDS_ENDPOINT = 'https://memstarbot.duckdns.org/commands.json';
const DISCORD_OPTION_TYPES = {
  1: 'Subcommand',
  2: 'Subcommand Group',
  3: 'Text',
  4: 'Integer',
  5: 'Boolean',
  6: 'User',
  7: 'Channel',
  8: 'Role',
  9: 'Mentionable',
  10: 'Number',
  11: 'Attachment'
};

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

function inferHint(token, type) {
  if (type && DISCORD_OPTION_TYPES[type]) return DISCORD_OPTION_TYPES[type];
  if (token.endsWith('_ms')) return 'Milliseconds value';
  if (token.endsWith('_id')) return 'Identifier value';
  if (token.includes('window')) return 'Duration window';
  if (token.includes('cooldown')) return 'Cooldown duration';
  if (token.includes('amount')) return 'Numeric amount';
  if (token.includes('max')) return 'Maximum allowed value';
  return 'Argument value';
}

function getQuickNotes(command) {
  if (!command || !Array.isArray(command.args) || !command.args.length) {
    return ['No additional notes for this command.'];
  }

  const notes = [];
  const hasMillis = command.args.some((arg) => arg.token.endsWith('_ms'));
  if (hasMillis) notes.push('Fields ending in _ms should be integer milliseconds.');

  const hasIds = command.args.some((arg) => arg.token.endsWith('_id') || arg.token.includes('role_id') || arg.token.includes('channel_id'));
  if (hasIds) notes.push('ID fields usually require raw Discord IDs, not mentions.');

  if (command.args.some((arg) => arg.hint === 'Boolean')) {
    notes.push('Boolean options typically accept true or false.');
  }

  if (!notes.length) notes.push('Review argument descriptions for expected format and examples.');
  return notes;
}

function parseCommandSignature(rawName, options, slashName) {
  const slash = typeof slashName === 'string' && slashName.trim()
    ? slashName.trim()
    : typeof rawName === 'string' && rawName.trim().startsWith('/')
      ? rawName.trim()
      : `/${String(rawName || 'unknown').trim()}`;

  if (Array.isArray(options) && options.length) {
    const args = options.map((option) => {
      const token = String(option && option.name ? option.name : 'value').trim();
      const required = Boolean(option && option.required);
      const optionDescription = option && option.description ? String(option.description).trim() : '';

      return {
        token,
        required,
        label: formatLabel(token),
        hint: inferHint(token, option && option.type),
        description: optionDescription
      };
    });

    const usageSuffix = args
      .map((arg) => (arg.required ? `<${arg.token}>` : `[${arg.token}]`))
      .join(' ');

    return {
      rawName: usageSuffix ? `${slash} ${usageSuffix}` : slash,
      baseName: slash,
      args
    };
  }

  const safeRaw = typeof rawName === 'string' ? rawName.trim() : slash;
  const baseMatch = slash.match(/^\/[a-zA-Z0-9_-]+/);
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
      hint: inferHint(token),
      description: ''
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

  const ingestCommands = (categoryName, commands) => {
    for (const command of commands) {
      const commandName = command && command.name ? command.name : 'unknown';
      const slashName = command && command.slash ? command.slash : `/${String(commandName).replace(/^\//, '')}`;
      const optionList = Array.isArray(command && command.options) ? command.options : [];
      const signature = parseCommandSignature(commandName, optionList, slashName);
      const description = command && command.description ? command.description : 'No description provided.';
      const id = `${categoryName}:${signature.baseName}`;

      results.push({
        id,
        categoryName,
        description,
        ...signature
      });
    }
  };

  for (const category of categories) {
    const categoryName = category && category.name ? category.name : 'Other';
    const commands = Array.isArray(category && category.commands) ? category.commands : [];
    ingestCommands(categoryName, commands);
  }

  if (!results.length && Array.isArray(data.allCommands)) {
    ingestCommands('Other', data.allCommands);
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
    if (detailNotes) detailNotes.innerHTML = '<li>No command selected.</li>';
    return;
  }

  detailCategory.textContent = command.categoryName;
  detailName.textContent = command.baseName;
  detailDescription.textContent = command.description;
  detailUsage.textContent = command.rawName;

  if (!command.args.length) {
    detailArgs.innerHTML = '<p class="muted">This command does not require arguments.</p>';
  } else {
    detailArgs.innerHTML = '';
    for (const arg of command.args) {
      const row = document.createElement('div');
      row.className = 'arg-item';

      const meta = document.createElement('div');
      meta.className = 'arg-meta';

      const badge = document.createElement('span');
      badge.className = arg.required ? 'arg-badge required' : 'arg-badge optional';
      badge.textContent = arg.required ? 'Required' : 'Optional';

      const typeBadge = document.createElement('span');
      typeBadge.className = 'arg-type';
      typeBadge.textContent = arg.hint;

      meta.appendChild(badge);
      meta.appendChild(typeBadge);

      const name = document.createElement('strong');
      name.textContent = arg.label;

      const hint = document.createElement('p');
      hint.className = 'muted arg-hint';
      hint.textContent = arg.description || arg.hint;

      row.appendChild(meta);
      row.appendChild(name);
      row.appendChild(hint);
      detailArgs.appendChild(row);
    }
  }

  if (detailNotes) {
    detailNotes.innerHTML = '';
    const notes = getQuickNotes(command);
    for (const note of notes) {
      const li = document.createElement('li');
      li.textContent = note;
      detailNotes.appendChild(li);
    }
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

    const name = document.createElement('span');
    name.textContent = command.baseName;

    const meta = document.createElement('span');
    meta.className = 'command-mini';
    meta.textContent = command.categoryName;

    button.appendChild(name);
    button.appendChild(meta);
    button.addEventListener('click', () => setSelectedCommand(command.id));
    fragment.appendChild(button);
  }

  commandsContainer.appendChild(fragment);
}

function applyCommandFilter() {
  const term = commandSearchInput ? commandSearchInput.value.trim().toLowerCase() : '';
  const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
  filteredCommands = allCommands.filter((command) => {
    if (selectedCategory !== 'all' && command.categoryName !== selectedCategory) return false;
    if (!term) return true;
    return (
      command.baseName.toLowerCase().includes(term)
      || command.rawName.toLowerCase().includes(term)
      || command.categoryName.toLowerCase().includes(term)
      || command.description.toLowerCase().includes(term)
      || command.args.some((arg) => arg.token.toLowerCase().includes(term)
        || arg.label.toLowerCase().includes(term)
        || (arg.description && arg.description.toLowerCase().includes(term))
        || arg.hint.toLowerCase().includes(term))
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
  renderPinnedCommand();
  populateCategoryFilter();
  applyCommandFilter();

  if (commandSearchInput) {
    commandSearchInput.addEventListener('input', applyCommandFilter);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyCommandFilter);
  }

  if (clearSearchButton) {
    clearSearchButton.addEventListener('click', () => {
      if (commandSearchInput) commandSearchInput.value = '';
      if (categoryFilter) categoryFilter.value = 'all';
      applyCommandFilter();
    });
  }

  if (commandsUpdatedAt && data.updatedAt) {
    const updatedAt = new Date(data.updatedAt);
    if (!Number.isNaN(updatedAt.getTime())) {
      commandsUpdatedAt.textContent = `Last updated: ${updatedAt.toLocaleString()}`;
    }
  }
}

function renderPinnedCommand() {
  if (!pinnedCommandName || !pinnedCommandDescription || !pinnedCommandAction) return;

  const pinned = allCommands.find((command) => command.baseName === '/config-panel');
  if (!pinned) {
    pinnedCommandName.textContent = '/config-panel';
    pinnedCommandDescription.textContent = 'Open the admin setup panel to configure key bot systems quickly.';
    pinnedCommandAction.disabled = true;
    pinnedCommandAction.textContent = '/config-panel Not Found';
    return;
  }

  pinnedCommandName.textContent = pinned.baseName;
  pinnedCommandDescription.textContent = pinned.description;
  pinnedCommandAction.disabled = false;
  pinnedCommandAction.textContent = 'Open /config-panel Details';
  pinnedCommandAction.onclick = () => {
    selectedCommandId = pinned.id;
    applyCommandFilter();
    if (commandSearchInput) commandSearchInput.value = pinned.baseName;
    if (categoryFilter) categoryFilter.value = pinned.categoryName;
    applyCommandFilter();
  };
}

function populateCategoryFilter() {
  if (!categoryFilter) return;

  const categories = Array.from(new Set(allCommands.map((command) => command.categoryName))).sort((a, b) => a.localeCompare(b));
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
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

if (copyUsageButton) {
  copyUsageButton.addEventListener('click', async () => {
    if (!detailUsage) return;
    try {
      await navigator.clipboard.writeText(detailUsage.textContent || '');
      copyUsageButton.textContent = 'Copied';
      setTimeout(() => {
        copyUsageButton.textContent = 'Copy';
      }, 1200);
    } catch (error) {
      copyUsageButton.textContent = 'Failed';
      setTimeout(() => {
        copyUsageButton.textContent = 'Copy';
      }, 1200);
    }
  });
}
