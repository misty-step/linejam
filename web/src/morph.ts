// A small DOM patcher. Views are HTML strings; this applies the difference to
// the live tree so focus, caret, typed text and running transitions survive a
// state update. Elements match by tag and `data-key`; a new key is a new node.

function keyOf(node: Node): string | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element).getAttribute('data-key') : null;
}

function same(a: Node, b: Node): boolean {
  if (a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== Node.ELEMENT_NODE) return true;
  return (a as Element).tagName === (b as Element).tagName && keyOf(a) === keyOf(b);
}

function patch(from: Node, to: Node): void {
  if (from.nodeType !== Node.ELEMENT_NODE) {
    if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
    return;
  }
  const a = from as Element;
  const b = to as Element;
  for (const { name } of [...a.attributes]) {
    if (!b.hasAttribute(name)) a.removeAttribute(name);
  }
  for (const { name, value } of [...b.attributes]) {
    // What the player typed belongs to the player, not to the template.
    if (name === 'value' && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) continue;
    if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  }
  if (a.tagName === 'TEXTAREA') return;
  children(a, b);
}

function children(from: Node, to: Node): void {
  let a = from.firstChild;
  let b = to.firstChild;
  while (b) {
    const next = b.nextSibling;
    if (a && same(a, b)) {
      patch(a, b);
      a = a.nextSibling;
    } else {
      const key = keyOf(b);
      let match: Node | null = null;
      if (key && a) {
        for (let n: Node | null = a.nextSibling; n; n = n.nextSibling) {
          if (keyOf(n) === key && same(n, b)) {
            match = n;
            break;
          }
        }
      }
      if (match) {
        from.insertBefore(match, a);
        patch(match, b);
      } else {
        from.insertBefore(b, a);
      }
    }
    b = next;
  }
  while (a) {
    const next = a.nextSibling;
    from.removeChild(a);
    a = next;
  }
}

export function morph(root: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  children(root, template.content);
}

export function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
