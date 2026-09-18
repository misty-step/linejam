// Landmark owns version analysis and notes. The local adapter separates reviewed
// artifact preparation from publication so master keeps its required merge-gate.
module.exports = {
  branches: ['master'],
  plugins: [
    './scripts/releases/semantic-release.mjs',
    ['@semantic-release/github', { successComment: false, failComment: false }],
  ],
};
