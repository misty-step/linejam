#!/usr/bin/env node
/**
 * Synthesize Release Notes
 *
 * Transforms technical changelog into user-friendly release notes using Gemini.
 * Runs as post-release step in GitHub Actions.
 */

const GITHUB_API = 'https://api.github.com';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

async function getLatestRelease() {
  const repo = process.env.GITHUB_REPOSITORY || 'phaedrus/linejam';
  const response = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      console.log('No releases found yet. Skipping synthesis.');
      return null;
    }
    throw new Error(`Failed to fetch release: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function synthesizeNotes(technicalNotes, version) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('GEMINI_API_KEY not set. Skipping LLM synthesis.');
    return null;
  }

  const prompt = `You are writing release notes for Linejam, a collaborative poetry game where players take turns adding lines to poems they can only partially see.

Transform these technical release notes into user-friendly notes. Focus on what users can do now that they couldn't before. Be concise and enthusiastic but not cheesy.

Format:
- Start with a one-line summary of the most exciting change
- Use bullet points for individual changes
- Group related changes together
- Skip internal/technical changes users don't care about (CI, tests, refactoring)
- Keep it under 200 words

Technical notes for version ${version}:
${technicalNotes}

User-friendly notes:`;

  const response = await fetch(`${GEMINI_API}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    }),
  });

  if (!response.ok) {
    console.error('Gemini API error:', await response.text());
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function updateRelease(releaseId, newBody) {
  const repo = process.env.GITHUB_REPOSITORY || 'phaedrus/linejam';
  const response = await fetch(`${GITHUB_API}/repos/${repo}/releases/${releaseId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: newBody }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update release: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  console.log('Fetching latest release...');
  const release = await getLatestRelease();

  if (!release) {
    return;
  }

  console.log(`Found release: ${release.tag_name}`);

  // Skip if already synthesized (contains our marker)
  if (release.body?.includes('<!-- synthesized -->')) {
    console.log('Release notes already synthesized. Skipping.');
    return;
  }

  console.log('Synthesizing user-friendly notes...');
  const userFriendlyNotes = await synthesizeNotes(release.body, release.tag_name);

  if (!userFriendlyNotes) {
    console.log('No synthesized notes generated.');
    return;
  }

  // Combine: user-friendly summary at top, technical details in collapsible
  const newBody = `${userFriendlyNotes}

<details>
<summary>Technical Details</summary>

${release.body}

</details>

<!-- synthesized -->`;

  console.log('Updating release with synthesized notes...');
  await updateRelease(release.id, newBody);
  console.log('Release notes updated successfully!');
}

main().catch((error) => {
  console.error('Error:', error.message);
  // Don't fail the workflow if synthesis fails
  process.exit(0);
});
