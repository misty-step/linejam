#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SKILL_DIR = resolve(REPO_ROOT, '.agents/skills/play-linejam');

const REQUIRED_FILES = [
  'SKILL.md',
  'coordinator.md',
  'player.md',
  'result.schema.json',
];

const DISALLOWED_SCHEMA_PROPERTIES = new Set([
  'roomCode',
  'room_code',
  'guestToken',
  'guest_token',
  'poemText',
  'poem_text',
  'lines',
  'poemLines',
  'rawPoem',
]);

function collectDisallowedProperties(schemaNode, found = []) {
  if (!schemaNode || typeof schemaNode !== 'object') return found;
  if (schemaNode.properties && typeof schemaNode.properties === 'object') {
    for (const key of Object.keys(schemaNode.properties)) {
      if (DISALLOWED_SCHEMA_PROPERTIES.has(key)) {
        found.push(key);
      }
      collectDisallowedProperties(schemaNode.properties[key], found);
    }
  }
  if (schemaNode.items) {
    collectDisallowedProperties(schemaNode.items, found);
  }
  return found;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      result[key] = val;
    }
  }
  return result;
}

function validate() {
  const errors = [];

  // 1. package.json checks
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8')
    );
    if (pkg.devDependencies?.['agent-browser'] !== '0.34.0') {
      errors.push(
        `package.json devDependencies.agent-browser must be exact "0.34.0", got: ${pkg.devDependencies?.['agent-browser']}`
      );
    }
    const checkScript = pkg.scripts?.['qa:play-linejam:check'];
    if (checkScript !== 'node ./scripts/qa/check-play-linejam-skill.mjs') {
      errors.push(
        `package.json scripts["qa:play-linejam:check"] must invoke check-play-linejam-skill.mjs, got: ${checkScript}`
      );
    }
  } catch (err) {
    errors.push(`Failed to parse package.json: ${err.message}`);
  }

  // 2. Required files existence & non-emptiness
  for (const file of REQUIRED_FILES) {
    const filePath = resolve(SKILL_DIR, file);
    if (!existsSync(filePath)) {
      errors.push(`Missing required skill file: ${file}`);
    } else if (readFileSync(filePath, 'utf8').trim().length === 0) {
      errors.push(`Skill file is empty: ${file}`);
    }
  }

  // 3. SKILL.md frontmatter
  const skillFile = resolve(SKILL_DIR, 'SKILL.md');
  if (existsSync(skillFile)) {
    const fm = parseFrontmatter(readFileSync(skillFile, 'utf8'));
    if (!fm) {
      errors.push('SKILL.md missing valid YAML frontmatter block');
    } else {
      if (fm.name !== 'play-linejam') {
        errors.push(
          `SKILL.md frontmatter name must be "play-linejam", got: ${fm.name}`
        );
      }
      if (!fm.description || fm.description.length === 0) {
        errors.push('SKILL.md frontmatter description is missing or empty');
      }
    }
  }

  // 4. result.schema.json validation
  const schemaFile = resolve(SKILL_DIR, 'result.schema.json');
  if (existsSync(schemaFile)) {
    try {
      const schema = JSON.parse(readFileSync(schemaFile, 'utf8'));
      if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
        errors.push(
          `result.schema.json $schema must be Draft 2020-12, got: ${schema.$schema}`
        );
      }

      if (schema.type !== 'object' || schema.additionalProperties !== false) {
        errors.push(
          'result.schema.json must be a closed top-level object schema'
        );
      }
      if (schema.properties?.totalRounds?.const !== 9) {
        errors.push('result.schema.json totalRounds must be const 9');
      }
      if (
        schema.properties?.playerCount?.minimum !== 2 ||
        schema.properties?.playerCount?.maximum !== 6 ||
        schema.properties?.players?.minItems !== 2 ||
        schema.properties?.players?.maxItems !== 6
      ) {
        errors.push('result.schema.json player counts must be bounded to 2-6');
      }

      const topRequired = [
        'runId',
        'target',
        'status',
        'startedAt',
        'finishedAt',
        'durationMs',
        'totalRounds',
        'roundsCompleted',
        'playerCount',
        'players',
        'verification',
        'evidence',
      ];
      for (const field of topRequired) {
        if (!schema.required?.includes(field) || !schema.properties?.[field]) {
          errors.push(
            `result.schema.json missing required top-level field: ${field}`
          );
        }
      }

      const verifRequired = [
        'roomClosed',
        'closedRoomJoinRejected',
        'allSessionsCleanedUp',
      ];
      for (const field of verifRequired) {
        if (!schema.properties?.verification?.required?.includes(field)) {
          errors.push(
            `result.schema.json verification missing required field: ${field}`
          );
        }
      }

      const playerRequired = [
        'seat',
        'role',
        'displayName',
        'sessionName',
        'roundsSubmitted',
        'revealedPoem',
        'status',
      ];
      for (const field of playerRequired) {
        if (!schema.properties?.players?.items?.required?.includes(field)) {
          errors.push(
            `result.schema.json players item missing required field: ${field}`
          );
        }
      }

      const artifactRequired = ['kind', 'path', 'sanitized', 'inspected'];
      for (const field of artifactRequired) {
        if (
          !schema.properties?.evidence?.properties?.artifacts?.items?.required?.includes(
            field
          )
        ) {
          errors.push(
            `result.schema.json evidence artifact missing required field: ${field}`
          );
        }
      }

      const disallowed = collectDisallowedProperties(schema);
      if (disallowed.length > 0) {
        errors.push(
          `result.schema.json contains disallowed sensitive properties: ${disallowed.join(', ')}`
        );
      }
    } catch (err) {
      errors.push(`Failed to parse result.schema.json: ${err.message}`);
    }
  }

  // 5. skill://play-linejam/... reference resolution
  const skillUriRegex = /skill:\/\/play-linejam\/([a-zA-Z0-9._-]+)/g;
  for (const file of ['SKILL.md', 'coordinator.md', 'player.md']) {
    const filePath = resolve(SKILL_DIR, file);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, 'utf8');
    let match;
    while ((match = skillUriRegex.exec(content)) !== null) {
      const referenced = match[1];
      if (!existsSync(resolve(SKILL_DIR, referenced))) {
        errors.push(
          `${file} references non-existent URI target: skill://play-linejam/${referenced}`
        );
      }
    }
  }

  if (errors.length > 0) {
    console.error(
      `\nplay-linejam skill check failed (${errors.length} errors):`
    );
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log('play-linejam skill check passed.');
  process.exit(0);
}

validate();
