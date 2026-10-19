'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const body = html.slice(html.indexOf('<body'));
const visible = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const DASH = /[–—]/;

test('title, heading, tagline and footer', () => {
  assert.ok(html.includes('<title>Snake | Classic Games</title>'));
  assert.ok(html.includes('<h1 id="game-title">Snake</h1>'));
  assert.ok(html.includes('<p class="tagline">Inspired by classic mobile games.</p>'));
  assert.ok(html.includes('<footer class="site-footer">\n    <p>Classic Games</p>'));
});

test('no em or en dashes in markup or in main.js code', () => {
  assert.ok(!DASH.test(html));
  assert.ok(!DASH.test(main.replace(/\/\/.*$/gm, '')));
});

test('badge and repeated board disclaimer are gone; one About note', () => {
  assert.ok(!/early prototype/i.test(visible));
  assert.ok(!/class="badge"|class="board-note"/.test(html));
  const note = 'An early version of Classic Games. Gameplay may differ from the originals.';
  assert.equal(visible.split(note).length - 1, 1);
  const help = html.slice(html.indexOf('id="dlg-help"'), html.indexOf('id="dlg-top"'));
  assert.ok(help.includes(note));
});

test('unavailable controls and engineering explanations are not shown', () => {
  assert.ok(!/level|maze|sound|vibration|unavailable|not implemented|why are/i.test(visible));
  assert.ok(!/sel-level|sel-maze|type="checkbox"/.test(html));
});

test('score copy uses 0 or No score yet, never dash placeholders', () => {
  assert.ok(html.includes('<dd id="score">0</dd>'));
  assert.ok(html.includes('<dd id="best">0</dd>'));
  assert.ok(main.includes("'No score yet.'"));
  assert.ok(main.includes("'Game over. Score '"));
  assert.ok(main.includes("'Board full. Score '"));
});

test('Slow is the default speed in markup', () => {
  assert.ok(html.includes('<strong id="speed-name">Slow</strong>'));
});
