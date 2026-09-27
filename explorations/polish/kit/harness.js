/* Screen harness for polish prototypes.
   - ?screen=<id> renders one screen full-viewport (used for 390x844 captures).
   - ?theme=dark applies the dark identity tokens (default light).
   - ?text=200 sets the root font size to 200% before rendering (text-scaling checks).
   - No ?screen renders a board of phone frames; ?group=<name> limits it to one group.
   Usage:
     LJ.mount({
       title: 'Concept name',
       stance: 'One sentence.',
       screens: [{ id: 'writing-r3', label: 'Writing, round 3', group: 'writing', render: (root, ctx) => { ... } }],
     });
   Screens without a group land in "screens". */
(function () {
  const params = new URLSearchParams(location.search);
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const textScale = Number(params.get('text'));
  if (textScale >= 50 && textScale <= 400) document.documentElement.style.fontSize = `${textScale}%`;

  function screenUrl(id, extra = {}) {
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('screen', id);
    if (theme === 'dark') url.searchParams.set('theme', 'dark');
    for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
    return url.toString();
  }

  function boardUrl(group) {
    const url = new URL(location.href);
    url.search = '';
    if (group) url.searchParams.set('group', group);
    if (theme === 'dark') url.searchParams.set('theme', 'dark');
    return url.toString();
  }

  function board(config) {
    const only = params.get('group');
    const groupOf = (screen) => screen.group || 'screens';
    const groups = [...new Set(config.screens.map(groupOf))];
    document.title = `${config.title} · board`;
    const wrap = document.createElement('main');
    wrap.style.cssText =
      'padding:24px;display:flex;flex-direction:column;gap:16px;font-family:var(--font-nunito)';
    const heading = document.createElement('h1');
    heading.textContent = config.title;
    heading.style.cssText = 'margin:0;font-size:1.5rem';
    wrap.append(heading);
    if (config.stance) {
      const stance = document.createElement('p');
      stance.textContent = config.stance;
      stance.style.cssText = 'margin:0;max-width:70ch;color:var(--color-text-secondary)';
      wrap.append(stance);
    }
    if (groups.length > 1) {
      const nav = document.createElement('nav');
      nav.setAttribute('aria-label', 'Screen groups');
      nav.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px';
      for (const group of [null, ...groups]) {
        const link = document.createElement('a');
        link.href = boardUrl(group);
        link.textContent = group ?? 'all';
        if ((group ?? null) === (only ?? null)) link.setAttribute('aria-current', 'page');
        link.style.cssText = 'color:var(--color-primary);font-weight:600';
        nav.append(link);
      }
      wrap.append(nav);
    }
    for (const group of groups) {
      if (only && group !== only) continue;
      const section = document.createElement('section');
      section.style.cssText = 'display:flex;flex-direction:column;gap:12px';
      if (groups.length > 1) {
        const title = document.createElement('h2');
        title.textContent = group;
        title.style.cssText = 'margin:8px 0 0;font-size:1.125rem';
        section.append(title);
      }
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start';
      for (const screen of config.screens.filter((s) => groupOf(s) === group)) {
        const figure = document.createElement('figure');
        figure.style.cssText = 'margin:0;display:flex;flex-direction:column;gap:8px';
        const frame = document.createElement('iframe');
        frame.src = screenUrl(screen.id);
        frame.title = screen.label;
        frame.width = '390';
        frame.height = '844';
        frame.loading = 'lazy';
        frame.style.cssText =
          'border:1px solid var(--color-border-subtle);border-radius:28px;background:var(--color-background)';
        const caption = document.createElement('figcaption');
        const link = document.createElement('a');
        link.href = screenUrl(screen.id);
        link.textContent = `${screen.label} (${screen.id})`;
        link.style.cssText = 'color:var(--color-text-secondary);font-size:.875rem';
        caption.append(link);
        figure.append(frame, caption);
        row.append(figure);
      }
      section.append(row);
      wrap.append(section);
    }
    document.body.append(wrap);
  }

  function mount(config) {
    const id = params.get('screen');
    if (!id) return board(config);
    const screen = config.screens.find((s) => s.id === id);
    const root = document.createElement('div');
    root.className = 'lj-screen';
    root.dataset.screen = id;
    document.body.append(root);
    if (!screen) {
      root.textContent = `Unknown screen: ${id}`;
      return;
    }
    document.title = `${config.title} · ${screen.label}`;
    screen.render(root, { theme, params });
  }

  window.LJ = window.LJ || {};
  window.LJ.mount = mount;
  window.LJ.theme = theme;
  window.LJ.params = params;
})();
