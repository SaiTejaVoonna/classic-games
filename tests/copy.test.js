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

test('unimplemented controls and engineering explanations are not shown', () => {
  assert.ok(!/sound|vibration|unavailable|not implemented|why are|choose a level/i.test(visible));
  assert.ok(!/sel-level|sel-maze|type="checkbox"/.test(html));
});

test('visible copy does not mention a phone brand', () => {
  assert.ok(!/nokia/i.test(visible));
});

test('settings: speed comfort note, board, edges, lives and bonus groups with safe defaults', () => {
  const settings = html.slice(html.indexOf('id="dlg-settings"'), html.indexOf('</dialog>', html.indexOf('id="dlg-settings"')));
  assert.ok(settings.includes('Speed choices are comfort settings, not original game levels.'));
  for (const name of ['theme', 'speed', 'board', 'edges', 'lives', 'bonus']) {
    assert.ok(new RegExp('name="' + name + '"').test(settings), name);
    assert.equal((settings.match(new RegExp('name="' + name + '"[^>]*checked', 'g')) || []).length, 1, name + ' has one default');
  }
  assert.ok(/name="lives" value="classic" checked/.test(settings), 'Classic is the default');
  assert.ok(/name="edges" value="walls" checked/.test(settings));
  assert.ok(/name="board" value="clear" checked/.test(settings));
  assert.ok(/name="bonus" value="on" checked/.test(settings));
  assert.ok(/value="unlimited"> Unlimited <small>\(assist mode\)<\/small>/.test(settings), 'Unlimited is labelled as an assist');
  assert.ok(settings.includes('Unlimited is an optional assist. Collisions never end the run.'));
  assert.ok(settings.includes('Classic Games choices, not verified original rules'));
});

test('instructions explain bonus food, wrap, mazes and lives in short plain sentences', () => {
  const help = html.slice(html.indexOf('id="dlg-help"'), html.indexOf('id="dlg-top"'));
  assert.ok(help.includes('Bonus food:'));
  assert.ok(help.includes('extra points and does not grow the snake'));
  assert.ok(help.includes('Missing it costs nothing.'));
  assert.ok(help.includes('with Wrap on, leaving one edge brings you back on the opposite edge'));
  assert.ok(help.includes('Maze blocks are solid.'));
  assert.ok(/costs a life/.test(help));
});

test('the panel shows the lives, rules summary and bonus timer slots', () => {
  assert.ok(html.includes('id="lives"'));
  assert.ok(html.includes('id="rules-line"'));
  assert.ok(html.includes('id="bonus-item" hidden'));
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
