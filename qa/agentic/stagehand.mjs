import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getMission } from './missions.mjs';

const DEFAULT_STAGEHAND_MODEL = 'openai/gpt-4.1-mini';

function modelApiKey(env) {
  return (
    env.STAGEHAND_MODEL_API_KEY ||
    env.OPENAI_API_KEY ||
    env.ANTHROPIC_API_KEY ||
    env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ''
  ).trim();
}

function stagehandModel(env) {
  return (env.STAGEHAND_MODEL || DEFAULT_STAGEHAND_MODEL).trim();
}

function explorationInstruction(mission) {
  return [
    `Explore Linejam mission "${mission.name}".`,
    mission.description,
    'Identify the room creation/join path, visible participant names, generic error UI, and any UX friction.',
    'Do not submit destructive actions beyond ordinary test room creation or joining.',
  ].join(' ');
}

export async function runStagehandExploration({
  baseUrl,
  env = process.env,
  mission: missionName,
  runDir,
  StagehandClass,
} = {}) {
  const mission = getMission(missionName);
  const apiKey = modelApiKey(env);
  const modelName = stagehandModel(env);
  const startedAt = new Date().toISOString();

  if (!apiKey) {
    return {
      ok: false,
      skipped: true,
      reason:
        'Stagehand model API key is required. Set STAGEHAND_MODEL_API_KEY or provider-specific model credentials.',
      modelName,
      startedAt,
      finishedAt: new Date().toISOString(),
      artifacts: [],
      transcript: [],
    };
  }

  let Stagehand = StagehandClass;
  if (!Stagehand) {
    ({ Stagehand } = await import('@browserbasehq/stagehand'));
  }

  const transcript = [];
  const artifacts = [];
  const stagehand = new Stagehand({
    env: 'LOCAL',
    model: {
      modelName,
      apiKey,
    },
    disablePino: true,
    localBrowserLaunchOptions: {
      headless: true,
    },
  });

  try {
    await stagehand.init();
    const page =
      stagehand.context.pages()[0] || (await stagehand.context.newPage());
    await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });

    const observations = await stagehand.observe(
      explorationInstruction(mission),
      {
        onlyVisible: true,
      }
    );
    transcript.push({
      actor: 'stagehand',
      text: `Observed ${Array.isArray(observations) ? observations.length : 0} candidate actions for ${mission.name}.`,
    });

    const screenshotPath = path.join(runDir, 'stagehand-overview.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    artifacts.push({ kind: 'screenshot', path: screenshotPath });

    const result = {
      ok: true,
      skipped: false,
      modelName,
      startedAt,
      finishedAt: new Date().toISOString(),
      observations: Array.isArray(observations)
        ? observations.map((observation) => ({
            description:
              typeof observation?.description === 'string'
                ? observation.description
                : String(observation),
            method: observation?.method,
          }))
        : [],
      artifacts,
      transcript,
    };

    await fs.writeFile(
      path.join(runDir, 'stagehand.json'),
      `${JSON.stringify(result, null, 2)}\n`
    );
    return result;
  } catch (error) {
    const result = {
      ok: false,
      skipped: false,
      reason: error instanceof Error ? error.message : String(error),
      modelName,
      startedAt,
      finishedAt: new Date().toISOString(),
      artifacts,
      transcript,
    };
    await fs.writeFile(
      path.join(runDir, 'stagehand.json'),
      `${JSON.stringify(result, null, 2)}\n`
    );
    return result;
  } finally {
    await stagehand.close({ force: true }).catch(() => {});
  }
}
