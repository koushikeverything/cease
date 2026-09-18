#!/usr/bin/env node
/**
 * Structural validator for the CEASE plugin.
 *
 * Stand-in for `claude plugin validate --strict`, which is BLOCKED in this
 * environment (the Claude CLI is not installed - see the leverage manifest's
 * toolchain row). Every rule below is traceable to a documented fact in the
 * koushik-jr `claude-plugin` ecosystem pack (verified 2026-09-16) or to the
 * live plugin docs fetched 2026-09-17.
 *
 * This does NOT replace `claude plugin validate --strict`; the check stage must
 * still run the real thing once the CLI is installed. It exists so that every
 * build unit has a genuine validation step instead of none.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const root = process.argv[2] ?? '.';
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// Pack fact: reserved marketplace names (claude-plugin.md, verified 2026-09-16)
const RESERVED = new Set([
  'claude-code-marketplace', 'claude-code-plugins', 'claude-plugins-official',
  'claude-plugins-community', 'anthropic-marketplace', 'anthropic-plugins',
  'anthropic-agent-skills', 'agent-skills', 'knowledge-work-plugins',
  'life-sciences', 'healthcare', 'claude-for-legal',
  'claude-for-financial-services', 'financial-services-plugins',
  'first-party-plugins', 'claude-tag-plugins',
]);

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Pack fact: description budget - Agent Skills standard is 1-1024 chars
const DESC_MAX = 1024;

const readJSON = (p) => {
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { fail(`${p}: invalid JSON - ${e.message}`); return null; }
};

/** Minimal YAML frontmatter reader: returns {} when absent. */
function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      if (v === '>-' || v === '>' || v === '|' || v === '|-') { out[key] = ''; continue; }
      out[key] = v.replace(/^["']|["']$/g, '');
    } else if (key && /^\s+\S/.test(line)) {
      out[key] = (out[key] ? out[key] + ' ' : '') + line.trim();
    }
  }
  return out;
}

// ---------- plugin.json ----------
const pluginPath = join(root, '.claude-plugin', 'plugin.json');
if (!existsSync(pluginPath)) fail('.claude-plugin/plugin.json is missing');
const plugin = existsSync(pluginPath) ? readJSON(pluginPath) : null;

if (plugin) {
  if (!plugin.name) fail('plugin.json: "name" is required');
  else if (!KEBAB.test(plugin.name)) fail(`plugin.json: name "${plugin.name}" must be kebab-case`);
  if (plugin.version && !/^\d+\.\d+\.\d+/.test(plugin.version))
    fail(`plugin.json: version "${plugin.version}" is not semver`);

  // Pack fact: relative component paths must start with "./" and never escape the plugin dir
  for (const key of ['hooks', 'skills', 'agents', 'mcpServers', 'lspServers', 'workflows', 'outputStyles']) {
    const v = plugin[key];
    const paths = typeof v === 'string' ? [v] : Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    for (const p of paths) {
      if (p === '.') continue;
      if (!p.startsWith('./')) fail(`plugin.json: ${key} path "${p}" must start with "./"`);
      if (p.includes('\\')) fail(`plugin.json: ${key} path "${p}" must not use backslashes`);
      if (p.includes('..')) fail(`plugin.json: ${key} path "${p}" must not escape the plugin directory`);
      if (!existsSync(join(root, p))) fail(`plugin.json: ${key} path "${p}" does not exist`);
    }
  }

  // Pack fact: userConfig.options requires CLI 2.1.271+ and is silently ignored below it.
  for (const [k, opt] of Object.entries(plugin.userConfig ?? {})) {
    if (!opt.type) fail(`userConfig.${k}: "type" is required`);
    if (!opt.title) fail(`userConfig.${k}: "title" is required`);
    if (!opt.description) fail(`userConfig.${k}: "description" is required`);
    if ('options' in opt) warn(`userConfig.${k}: "options" needs CLI 2.1.271+ and is silently ignored below it`);
  }
}

// ---------- marketplace.json ----------
const mpPath = join(root, '.claude-plugin', 'marketplace.json');
if (existsSync(mpPath)) {
  const mp = readJSON(mpPath);
  if (mp) {
    if (!mp.name) fail('marketplace.json: "name" is required');
    else if (RESERVED.has(mp.name)) fail(`marketplace.json: "${mp.name}" is a reserved marketplace name`);
    else if (!KEBAB.test(mp.name)) fail(`marketplace.json: name "${mp.name}" must be kebab-case`);
    if (!mp.owner?.name) fail('marketplace.json: "owner.name" is required');
    if (!Array.isArray(mp.plugins) || mp.plugins.length === 0) fail('marketplace.json: "plugins" must be a non-empty array');
    for (const entry of mp.plugins ?? []) {
      if (!entry.name) fail('marketplace.json: every plugin entry needs "name"');
      if (!entry.source) fail(`marketplace.json: plugin "${entry.name}" needs "source"`);
      // Pack fact: plugin.json wins when BOTH set version - avoid double-setting
      if (entry.version && plugin?.version)
        warn(`marketplace.json: entry "${entry.name}" sets version while plugin.json does too; plugin.json wins`);
      if (plugin && entry.name !== plugin.name)
        warn(`marketplace.json: entry name "${entry.name}" != plugin.json name "${plugin.name}"`);
    }
  }
}

// ---------- skills ----------
const skillsDir = join(root, 'skills');
let skillCount = 0;
if (existsSync(skillsDir)) {
  for (const name of readdirSync(skillsDir)) {
    const dir = join(skillsDir, name);
    if (!statSync(dir).isDirectory()) continue;
    const skill = join(dir, 'SKILL.md');
    if (!existsSync(skill)) { fail(`skills/${name}: SKILL.md is missing`); continue; }
    skillCount++;
    const fm = frontmatter(skill);
    if (!fm.name) fail(`skills/${name}/SKILL.md: frontmatter "name" is required`);
    // `claude plugin validate` does NOT catch this (pack, verified 2026-09-16)
    else if (fm.name !== name) fail(`skills/${name}/SKILL.md: name "${fm.name}" must match its directory "${name}"`);
    else if (!KEBAB.test(fm.name)) fail(`skills/${name}: name must be lowercase and hyphenated`);
    if (!fm.description) fail(`skills/${name}/SKILL.md: frontmatter "description" is required`);
    else {
      if (fm.description.length > DESC_MAX)
        fail(`skills/${name}: description is ${fm.description.length} chars, over the ${DESC_MAX} limit`);
      if (!/not for/i.test(fm.description))
        fail(`skills/${name}: description has no "Not for" boundary (description-quality.md)`);
      if (!/koushik/i.test(fm.description))
        fail(`skills/${name}: description must disown durable Eve agents (koushik plugin)`);
      if (!/use when|use it when/i.test(fm.description))
        warn(`skills/${name}: description has no explicit "Use when" clause`);
    }
  }
}

// ---------- agents ----------
const agentsDir = join(root, 'agents');
let agentCount = 0;
if (existsSync(agentsDir)) {
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!e.endsWith('.md')) continue;
      agentCount++;
      const fm = frontmatter(p);
      // Pack fact: missing name -> file treated as documentation; missing description -> skipped and logged
      if (!fm.name) fail(`${p}: frontmatter "name" is required (without it the file is treated as documentation)`);
      else if (fm.name.includes(':')) fail(`${p}: agent name must not contain ":"`);
      else if (!KEBAB.test(fm.name)) fail(`${p}: agent name must be lowercase and hyphenated`);
      else if (fm.name !== basename(e, '.md')) warn(`${p}: name "${fm.name}" differs from filename`);
      if (!fm.description) fail(`${p}: frontmatter "description" is required (without it the agent is skipped)`);
      // Pack fact: mcpServers/hooks are IGNORED for plugin subagents
      if ('mcpServers' in fm) fail(`${p}: "mcpServers" is IGNORED for plugin subagents - remove it`);
      if ('hooks' in fm) fail(`${p}: "hooks" is IGNORED for plugin subagents - remove it`);
      if ('maxTurns' in fm) warn(`${p}: "maxTurns" needs CLI 2.1.246+ and is silently ignored below it`);
      if ('omitClaudeMd' in fm) warn(`${p}: "omitClaudeMd" needs CLI 2.1.271+ and is silently ignored below it`);
    }
  };
  walk(agentsDir);
}

// ---------- hooks ----------
const hooksPath = join(root, 'hooks', 'hooks.json');
if (existsSync(hooksPath)) {
  const h = readJSON(hooksPath);
  if (h) {
    if (!h.hooks || typeof h.hooks !== 'object')
      fail('hooks/hooks.json: top level must be an object with a "hooks" key (verified live 2026-09-17)');
    for (const [event, entries] of Object.entries(h.hooks ?? {})) {
      if (!Array.isArray(entries)) { fail(`hooks.json: ${event} must be an array`); continue; }
      for (const entry of entries) {
        for (const hook of entry.hooks ?? []) {
          if (!hook.type) fail(`hooks.json: ${event} hook is missing "type"`);
          if (hook.type === 'command') {
            if (!hook.command) fail(`hooks.json: ${event} command hook is missing "command"`);
            // ${user_config.*} only expands in exec form (args present) - live docs 2026-09-17
            const shellForm = !Array.isArray(hook.args);
            const usesUserConfig = JSON.stringify(hook).includes('${user_config.');
            if (shellForm && usesUserConfig)
              fail(`hooks.json: ${event} uses \${user_config.*} in shell form - this errors at runtime; use exec form or $CLAUDE_PLUGIN_OPTION_<KEY>`);
            const ref = (hook.command ?? '').replace('${CLAUDE_PLUGIN_ROOT}/', '').replace(/^"|"$/g, '');
            if (ref && !ref.includes('$') && !existsSync(join(root, ref)) && !existsSync(ref))
              fail(`hooks.json: ${event} command "${hook.command}" does not resolve to a file`);
          }
        }
      }
    }
  }
}

// ---------- report ----------
const label = `${skillCount} skill(s), ${agentCount} agent(s)`;
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`FAIL  ${e}`);
console.log(errors.length
  ? `\n${errors.length} error(s), ${warnings.length} warning(s) - ${label}`
  : `ok    structure valid - ${label}, ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
