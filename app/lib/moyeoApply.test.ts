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
