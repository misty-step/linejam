let ready = false;

export function markPostHogReady() {
  ready = true;
}

export function resetPostHogReady() {
  ready = false;
}

export function posthogIsReady() {
  return ready;
}
