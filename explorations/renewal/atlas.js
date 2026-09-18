const groups = { view: 'views', component: 'components', motion: 'motion', sensory: 'sensory' };
const labels = { view: 'View', component: 'Component', motion: 'Motion', sensory: 'Sensory' };
const byId = (id) => document.getElementById(id);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const prose = (value) => Array.isArray(value) ? value.join(' ') : value && typeof value === 'object' ? Object.values(value).map(prose).join(' ') : String(value ?? '');
const text = (value) => escape(prose(value));
const option = (value, label) => `<option value="${escape(value)}">${escape(label)}</option>`;

async function load(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Cannot load ${path}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const [brief, inventory, audit] = await Promise.all([load('brief.json'), load('inventory.json'), load('audit-source.json')]);
  const directions = await Promise.all(brief.directions.map(({ id }) => load(`${id}/direction.json`)));
  const query = new URLSearchParams(location.search);
  const state = {
    surface: Object.hasOwn(groups, query.get('surface')) ? query.get('surface') : 'view',
    id: query.get('id') || 'home',
    mode: ['signature', 'light', 'dark'].includes(query.get('mode')) ? query.get('mode') : 'signature',
    cue: query.get('state') || '',
    reduced: query.get('reduced') === '1',
    active: directions.some(({ id }) => id === query.get('direction')) ? query.get('direction') : 'fold-club',
  };
  byId('surface').value = state.surface;
  byId('mode').value = state.mode;
  byId('state').value = state.cue;
  byId('reduced').checked = state.reduced;
  byId('active-direction').innerHTML = directions.map(({ id, name }) => option(id, name)).join('');
  byId('active-direction').value = state.active;

  function link(direction, embedded = false) {
    const parameters = new URLSearchParams({
      surface: state.surface,
      id: state.id,
      mode: state.mode === 'signature' ? direction.id === 'midnight-matinee' ? 'dark' : 'light' : state.mode,
    });
    if (state.cue) parameters.set('state', state.cue);
    if (state.reduced) parameters.set('reduced', '1');
    if (embedded) parameters.set('embed', '1');
    return `${direction.id}/?${parameters}`;
  }

  const previewObserver = new ResizeObserver((entries) => {
    for (const entry of entries) entry.target.style.setProperty('--preview-scale', String(entry.contentRect.width / 390));
  });

  function selectSurface(surface, id, direction) {
    state.surface = surface;
    state.id = id;
    state.cue = '';
    byId('surface').value = surface;
    byId('state').value = '';
    if (direction) {
      state.active = direction;
      byId('active-direction').value = direction;
    }
    fillSurfaceOptions();
    render();
  }

  function fillSurfaceOptions() {
    const entries = inventory[groups[state.surface]];
    if (!entries.some(({ id }) => id === state.id)) state.id = entries[0].id;
    byId('surface-id').innerHTML = entries.map(({ id, label }) => option(id, label)).join('');
    byId('surface-id').value = state.id;
  }

  function renderNotes(direction) {
    const treatment = direction[groups[state.surface]].find(({ id }) => id === state.id);
    const fieldLabels = { composition: 'Composition', hierarchy: 'Hierarchy', interaction: 'Interaction', mobile: 'On a phone', motion: 'Motion', copy: 'Voice', treatment: 'Treatment', states: 'States', accessibility: 'Accessibility', choreography: 'Choreography', timing: 'Timing', reducedMotion: 'Reduced motion', controls: 'Controls', risk: 'Risk' };
    byId('direction-notes').innerHTML = `<h3>${escape(direction.name)}</h3><p>${escape(direction.thesis)}</p>${Object.entries(treatment || {}).filter(([key]) => key !== 'id').map(([key, value]) => `<h4>${escape(fieldLabels[key] || key)}</h4><p>${text(value)}</p>`).join('')}<details><summary>Whole-direction tradeoffs</summary><ul>${direction.tradeoffs.map((risk) => `<li>${text(risk)}</li>`).join('')}</ul></details><p><a href="${direction.id}/direction.json">Complete design specification</a></p>`;
  }

  function renderActive() {
    const direction = directions.find(({ id }) => id === state.active);
    byId('live-frame').src = link(direction, true);
    byId('live-frame').title = `${direction.name}: ${state.id}, interactive design sketch`;
    byId('open-direction').href = link(direction);
    renderNotes(direction);
  }

  function render() {
    const source = inventory[groups[state.surface]].find(({ id }) => id === state.id);
    byId('surface-purpose').textContent = source.purpose || source.role || source.trigger || source.label;
    byId('state-cues').innerHTML = [...new Set(['loading', 'empty', 'error', 'long', 'exact', 'sending', 'accepted', ...(source.states || [])])].map((cue) => option(cue, cue)).join('');
    previewObserver.disconnect();
    byId('comparison-grid').innerHTML = directions.map((direction, index) => {
      const proposal = brief.directions[index];
      return `<article class="direction-card"><h3><a href="${link(direction)}" target="_blank" rel="noopener">${escape(direction.name)}</a></h3><p class="thesis">${escape(direction.thesis)}</p><div class="frame-window"><iframe src="${link(direction, true)}" title="${escape(direction.name)}: ${escape(source.label)} preview" tabindex="-1" inert></iframe></div><div class="palette" aria-label="${escape(direction.name)} palette">${Object.entries(proposal.palette).map(([name, color]) => `<span style="--swatch:${escape(color)}" title="${escape(name)} ${escape(color)}"></span>`).join('')}</div><div class="card-actions"><button data-inspect="${direction.id}" type="button">Try ${escape(direction.name)}</button></div><details class="card-detail"><summary>Idea and tradeoff</summary><p>${escape(proposal.signature)}</p><p>${escape(proposal.risk)}</p><p>${escape(proposal.type.display)} / ${escape(proposal.type.body)}</p></details></article>`;
    }).join('');
    for (const frame of document.querySelectorAll('.frame-window')) previewObserver.observe(frame);
    for (const button of document.querySelectorAll('[data-inspect]')) button.addEventListener('click', () => {
      state.active = button.dataset.inspect;
      byId('active-direction').value = state.active;
      renderActive();
      byId('workbench').scrollIntoView({ behavior: 'auto' });
    });
    renderActive();
    const parameters = new URLSearchParams({ surface: state.surface, id: state.id, mode: state.mode, direction: state.active });
    if (state.cue) parameters.set('state', state.cue);
    if (state.reduced) parameters.set('reduced', '1');
    history.replaceState(null, '', `?${parameters}${location.hash}`);
  }

  function renderInventory() {
    const search = byId('inventory-search').value.trim().toLowerCase();
    byId('inventory-rows').innerHTML = Object.entries(groups).flatMap(([surface, group]) => inventory[group].filter((entry) => !search || `${entry.id} ${entry.label} ${(entry.sources || []).join(' ')}`.toLowerCase().includes(search)).map((entry) => `<tr><th scope="row"><span class="inventory-kind">${labels[surface]}</span>${escape(entry.label)}</th>${directions.map((direction) => {
      const treatment = direction[group].find(({ id }) => id === entry.id);
      const summary = treatment && (treatment.composition || treatment.treatment || treatment.choreography);
      return `<td>${summary ? `<button type="button" data-surface="${surface}" data-id="${escape(entry.id)}" data-direction="${direction.id}" title="${text(summary)}">${text(prose(summary).split(/[.!?](?:\s|$)/)[0])}</button>` : '<span class="missing">Missing treatment</span>'}</td>`;
    }).join('')}</tr>`)).join('');
    for (const button of byId('inventory-rows').querySelectorAll('button')) button.addEventListener('click', () => {
      selectSurface(button.dataset.surface, button.dataset.id, button.dataset.direction);
      byId('workbench').scrollIntoView({ behavior: 'auto' });
    });
  }

  byId('comparison-controls').addEventListener('submit', (event) => event.preventDefault());
  byId('surface').addEventListener('change', (event) => selectSurface(event.target.value, ''));
  byId('surface-id').addEventListener('change', (event) => selectSurface(state.surface, event.target.value));
  byId('mode').addEventListener('change', (event) => { state.mode = event.target.value; render(); });
  byId('state').addEventListener('change', (event) => { state.cue = event.target.value; render(); });
  byId('reduced').addEventListener('change', (event) => { state.reduced = event.target.checked; render(); });
  byId('active-direction').addEventListener('change', (event) => { state.active = event.target.value; renderActive(); });
  byId('canvas').addEventListener('change', (event) => byId('live-frame').style.setProperty('--live-width', `${event.target.value}px`));
  byId('restart-sketch').addEventListener('click', renderActive);
  byId('inventory-search').addEventListener('input', renderInventory);
  byId('inventory-columns').insertAdjacentHTML('beforeend', directions.map(({ name }) => `<th scope="col">${escape(name)}</th>`).join(''));
  const total = Object.values(groups).reduce((count, group) => count + inventory[group].length, 0);
  const missing = directions.flatMap((direction) => Object.values(groups).flatMap((group) => inventory[group].filter((entry) => !direction[group].some(({ id }) => id === entry.id))));
  byId('coverage-summary').textContent = `${inventory.views.length} views, ${inventory.components.length} component/composition owners, ${inventory.motion.length} motion/lifecycle elements and ${inventory.sensory.length} sensory elements. ${total * directions.length} explicit design treatments; ${missing.length} missing inventory entries. Coverage is not a claim of production implementation.`;
  byId('audit-findings').innerHTML = audit.findings.map((finding) => `<details><summary><span class="finding-area">${escape(finding.area)} / ${finding.evidence === 'operator' ? 'Operator observation' : 'Source inspection'}</span>${escape(finding.observation)}</summary><p><strong>Consequence:</strong> ${escape(finding.consequence)}</p><p><strong>Decision:</strong> ${escape(finding.recommendation)}</p><p><strong>Inspect:</strong> ${escape(finding.verify)}</p><div class="source-paths">${finding.sources.map((source) => `<code>${escape(source)}</code>`).join('')}</div></details>`).join('');
  byId('workflow-alternatives').innerHTML = audit.workflowAlternatives.map((alternative) => `<details><summary>${escape(alternative.label || alternative.area || alternative.id)}</summary>${Object.entries(alternative).filter(([key]) => !['id', 'label', 'area'].includes(key)).map(([key, value]) => `<p><strong>${escape(key)}:</strong> ${text(value)}</p>`).join('')}</details>`).join('');
  fillSurfaceOptions();
  render();
  renderInventory();
  const verification = await fetch('verification.json');
  if (verification.ok) {
    const receipt = await verification.json();
    byId('verification-note').textContent = receipt.summary;
    byId('verification-note').insertAdjacentHTML('beforeend', ' <a href="verification.json">Inspect the verification receipt.</a>');
  }
}

main().catch((error) => {
  byId('load-error').hidden = false;
  byId('load-error').textContent = `${error.message}. Serve this directory with pnpm design:explore; do not open the HTML as a file URL.`;
});
