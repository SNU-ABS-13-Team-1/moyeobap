import assert from 'node:assert/strict';
import test from 'node:test';
import { validateApplyAcademicRank, validateApplyChoices } from './moyeoApply';

const choices = ['a', 'b', 'c', 'd', 'e'];

test('all five distinct choices are required on every save', () => {
  assert.equal(validateApplyChoices(choices), null);
  for (const invalid of [null, [], choices.slice(0, 4), [...choices, 'f'], ['a', 'b', '', 'd', 'e'], ['a', 'b', null, 'd', 'e'], ['a', 'a', 'c', 'd', 'e']]) {
    assert.ok(validateApplyChoices(invalid));
  }
});

test('academic rank is optional but must be a positive PostgreSQL integer when present', () => {
  for (const valid of [null, 1, 12, 2147483647]) assert.equal(validateApplyAcademicRank(valid), null);
  for (const invalid of [undefined, '', '12', 0, -1, 1.5, NaN, Infinity, 2147483648, true]) {
    assert.ok(validateApplyAcademicRank(invalid));
  }
});

test('rank sort is ascending with name ties and unranked names last', async () => {
  const { sortApplyParticipants } = await import('./moyeoApply');
  const rows = [
    { displayName: '다', choices, isMe: false, isConfirmed: false, academicRank: null },
    { displayName: '나', choices, isMe: false, isConfirmed: false, academicRank: 2 },
    { displayName: '가', choices, isMe: false, isConfirmed: false, academicRank: 2 },
    { displayName: '라', choices, isMe: false, isConfirmed: false, academicRank: 1 },
    { displayName: '마', choices, isMe: false, isConfirmed: false },
  ];
  assert.deepEqual(sortApplyParticipants(rows, new Map(), 'academicRank', true).map(row => row.displayName), ['라', '가', '나', '다', '마']);
  assert.equal(rows[0].displayName, '다');
});

test('unregistered viewer cannot infer changed ranks from a forced rank-sort selection', async () => {
  const { sortApplyParticipants } = await import('./moyeoApply');
  const rows = ['다', '가', '나'].map((displayName, i) => ({ displayName, choices, isMe: false, isConfirmed: false, academicRank: i + 1 }));
  const altered = rows.map(row => ({ ...row, academicRank: 100 - row.academicRank }));
  const names = (input: typeof rows) => sortApplyParticipants(input, new Map(), 'academicRank', false).map(row => row.displayName);
  assert.deepEqual(names(rows), ['가', '나', '다']);
  assert.deepEqual(names(altered), names(rows));
});


test('legacy DB responses fail closed before the API returns participant names', async () => {
  const { hasApplyPrivacyPolicy } = await import('./moyeoApply');
  assert.equal(hasApplyPrivacyPolicy({ privacyVersion: 1 }), true);
  for (const value of [null, {}, { participants: [{ displayName: '실명' }] }, { privacyVersion: '1' }, { privacyVersion: 0 }]) {
    assert.equal(hasApplyPrivacyPolicy(value), false);
  }
});
