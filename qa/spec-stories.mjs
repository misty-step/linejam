// SPEC.md is the only story catalog; keep selection independent of runtime setup.
export function liveStoriesFromSpec(source) {
  const headings = [...source.matchAll(/^(#{1,6}) (.+)$/gm)];
  const seen = new Set();
  const live = new Map();
  let capability = false;
  for (let i = 0; i < headings.length; i++) {
    const [heading, level, title] = headings[i];
    if (level.length <= 2) {
      capability = /^## Capability: \S.*$/.test(heading);
    }
    if (!title.startsWith('US-')) continue;
    const story = /^### (US-\d+) \[(live|next|later)\] (\S.*)$/.exec(heading);
    if (!story || !capability) {
      throw new Error(
        'SPEC.md stories need a capability and a valid status heading.'
      );
    }
    const [, id, status] = story;
    if (seen.has(id)) throw new Error(`Duplicate SPEC.md story: ${id}`);
    seen.add(id);
    if (status !== 'live') continue;
    const end = headings
      .slice(i + 1)
      .find((value) => value[1].length <= 3)?.index;
    const section = source.slice(headings[i].index + heading.length, end);
    const criteria = [
      ...section.matchAll(/^(\d+)\. (?:WHEN|IF|WHILE|WHERE|THE\b|EACH\b)/gm),
    ].map((match) => Number(match[1]));
    if (!criteria.length || criteria.some((n, index) => n !== index + 1)) {
      throw new Error(
        `SPEC.md story needs consecutive numbered criteria: ${id}`
      );
    }
    live.set(id, criteria);
  }
  if (!live.size) throw new Error('SPEC.md has no live stories to walk.');
  return live;
}
