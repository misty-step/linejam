let entryModule;
let failures = 0;
function load() {
  // Browsers cache rejected module fetches; retry must use a fresh module URL.
  entryModule ??= import(`/entry-wasm/entry.js?attempt=${failures}`)
    .then(async (entry) => {
      await entry.default();
      return entry;
    })
    .catch((error) => {
      entryModule = undefined;
      failures += 1;
      throw error;
    });
  return entryModule;
}

customElements.define(
  'linejam-entry',
  class extends HTMLElement {
    static observedAttributes = ['value', 'disabled', 'ready'];
    attributeChangedCallback() {
      this.dispatchEvent(new Event('entry-update'));
    }
    connectedCallback() {
      const attempt = (this.attempt = {});
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = 'Loading…';
      this.replaceChildren(status);
      load()
        .then(({ mount_entry, mount_join, mount_avatar }) => {
          if (!this.isConnected || this.attempt !== attempt) return;
          this.replaceChildren();
          const view = this.getAttribute('view');
          if (view === 'join') {
            this.unmount = mount_join(
              this,
              (code, displayName, avatarId) =>
                new Promise((resolve, reject) => {
                  const event = new CustomEvent('entry-submit', {
                    bubbles: true,
                    cancelable: true,
                    detail: { code, displayName, avatarId, resolve, reject },
                  });
                  // A missing boundary must recover visibly, not leave an
                  // infinite pending form. The consumer accepts responsibility.
                  if (this.dispatchEvent(event))
                    resolve('Unable to connect. Please refresh and try again.');
                })
            );
          } else if (view === 'avatar-picker') {
            this.unmount = mount_avatar(this, (value) =>
              this.dispatchEvent(
                new CustomEvent('entry-change', {
                  bubbles: true,
                  detail: value,
                })
              )
            );
          } else {
            this.unmount = mount_entry(this, view, () =>
              this.dispatchEvent(new Event('entry-close', { bubbles: true }))
            );
          }
        })
        .catch(() => {
          if (!this.isConnected || this.attempt !== attempt) return;
          this.dispatchEvent(new Event('entry-error', { bubbles: true }));
          status.setAttribute('role', 'alert');
          status.textContent = 'Could not load this view. ';
          this.replaceChildren(status);
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Retry';
          retry.addEventListener('click', () => this.connectedCallback(), {
            once: true,
          });
          status.append(retry);
        });
    }
    disconnectedCallback() {
      this.attempt = undefined;
      this.unmount?.();
      this.unmount = undefined;
    }
  }
);
