const test = require('node:test');
const assert = require('node:assert');
const { trayTip } = require('../main/tray');

const today = new Date(2026, 9, 15, 14, 30);

test('counts overdue and due-today tasks', () => {
  const tasks = [
    { due: '2026-10-14' }, { due: '2026-10-01' }, // overdue
    { due: '2026-10-15' },                         // today
    { due: '2026-10-16' },                         // later
  ];
  assert.strictEqual(trayTip(tasks, today), 'Romulus — 2 overdue · 1 due today');
});

test('done, undated and agent tasks are left out', () => {
  const tasks = [{ due: '2026-10-01', done: true }, { title: 'no date' }, { due: '2026-10-01', ws: 'agent' }];
  assert.strictEqual(trayTip(tasks, today), 'Romulus');
});

test('only due today', () => {
  assert.strictEqual(trayTip([{ due: '2026-10-15' }], today), 'Romulus — 1 due today');
});
