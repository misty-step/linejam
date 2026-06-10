export const MISSION_NAMES = [
  'guest-host-signed-in-join',
  'signed-in-host-guest-join',
];

export const MISSIONS = Object.freeze({
  'guest-host-signed-in-join': Object.freeze({
    name: 'guest-host-signed-in-join',
    description:
      'Guest host creates a room and a signed-in Clerk player joins it.',
    requiresAuth: true,
    expectedScreenshots: ['host-lobby.png', 'signed-in-join.png'],
    expectedChecks: [
      'guest host created room',
      'signed-in player joined room',
      'host sees signed-in player',
      'signed-in player sees host',
      'generic error UI absent',
    ],
  }),
  'signed-in-host-guest-join': Object.freeze({
    name: 'signed-in-host-guest-join',
    description: 'Signed-in Clerk host creates a room and a guest joins it.',
    requiresAuth: true,
    expectedScreenshots: ['signed-in-host-lobby.png', 'guest-join.png'],
    expectedChecks: [
      'signed-in host created room',
      'guest player joined room',
      'signed-in host sees guest',
      'guest sees signed-in host',
      'generic error UI absent',
    ],
  }),
});

export function getMission(name) {
  const mission = MISSIONS[name];
  if (!mission) {
    throw new Error(
      `Unknown agentic QA mission: ${name}. Expected one of ${MISSION_NAMES.join(', ')}`
    );
  }
  return mission;
}
