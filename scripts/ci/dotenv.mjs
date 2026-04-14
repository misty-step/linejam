import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function decodeDoubleQuotedEscape(char) {
  switch (char) {
    case 'n':
      return '\n';
    case 'r':
      return '\r';
    case 't':
      return '\t';
    case '"':
      return '"';
    case '\\':
      return '\\';
    default:
      return `\\${char}`;
  }
}

function parseQuotedValue(rawValue, quote, lineNumber) {
  let value = '';
  let escaped = false;

  for (let index = 1; index < rawValue.length; index += 1) {
    const char = rawValue[index];

    if (quote === '"' && escaped) {
      value += decodeDoubleQuotedEscape(char);
      escaped = false;
      continue;
    }

    if (quote === '"' && char === '\\') {
      escaped = true;
      continue;
    }

    if (char === quote) {
      const remainder = rawValue.slice(index + 1).trimStart();
      if (!remainder || remainder.startsWith('#')) {
        return value;
      }

      throw new Error(
        `Invalid trailing content after quoted value on line ${lineNumber}`
      );
    }

    value += char;
  }

  if (quote === '"' && escaped) {
    throw new Error(`Invalid escape sequence on line ${lineNumber}`);
  }

  throw new Error(`Unterminated quoted value on line ${lineNumber}`);
}

function parseUnquotedValue(rawValue) {
  for (let index = 0; index < rawValue.length; index += 1) {
    if (
      rawValue[index] === '#' &&
      index > 0 &&
      /\s/.test(rawValue[index - 1])
    ) {
      return rawValue.slice(0, index).trim();
    }
  }

  return rawValue.trim();
}

export function parseDotenv(content) {
  const entries = [];

  for (const [index, rawLine] of content.split(/\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || /^\s*#/.test(line)) {
      continue;
    }

    const exportedLine = line.replace(/^\s*export\s+/, '');
    const match = exportedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const firstChar = rawValue[0];
    const value =
      firstChar === '"' || firstChar === "'"
        ? parseQuotedValue(rawValue, firstChar, lineNumber)
        : parseUnquotedValue(rawValue);

    entries.push([key, value]);
  }

  return entries;
}

export function loadDotenvFile(path) {
  return parseDotenv(readFileSync(path, 'utf8'));
}

function runCli() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: node scripts/ci/dotenv.mjs <env-file>');
    process.exit(1);
  }

  for (const [key, value] of loadDotenvFile(path)) {
    process.stdout.write(`${key}\0${value}\0`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
