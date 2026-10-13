import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { parseScenario } from '@arena/mars-world';
export async function loadScenario(path = resolve('scenarios/mars/habitat-b-leak/scenario.yaml')) {
  return parseScenario(parse(await readFile(path, 'utf8')));
}
