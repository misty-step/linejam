let entryModule;
function load() {
  entryModule ??= import('/entry-wasm/entry.js')
    .then(async (entry) => {
      await entry.default();
      return entry;
    })
    .catch((error) => {
      entryModule = undefined;
      throw error;
    });
  return entryModule;
}

customElements.define(
  'linejam-entry',
  class extends HTMLElement {
    connectedCallback() {
      const attempt = (this.attempt = {});
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = 'Loading…';
      this.replaceChildren(status);
      load().then(
        ({ mount_entry }) => {
          if (!this.isConnected || this.attempt !== attempt) return;
          this.replaceChildren();
          this.unmount = mount_entry(this, this.getAttribute('view'), () =>
            this.dispatchEvent(new Event('entry-close', { bubbles: true }))
          );
        },
        () => {
          if (!this.isConnected || this.attempt !== attempt) return;
          status.setAttribute('role', 'alert');
          status.textContent = 'Could not load this view. ';
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Retry';
          retry.addEventListener('click', () => this.connectedCallback(), {
            once: true,
          });
          status.append(retry);
        }
      );
    }
    disconnectedCallback() {
      this.attempt = undefined;
      this.unmount?.();
      this.unmount = undefined;
    }
  }
);
