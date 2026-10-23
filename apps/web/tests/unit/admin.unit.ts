import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdminEmail } from '../../src/utils/admin';

test('isAdminEmail allows only authorized admin emails, case-insensitive and trimmed', () => {
  assert.equal(isAdminEmail('ztafakss@gmail.com'), true);
  assert.equal(isAdminEmail('prizzypelo@gmail.com'), true);
  assert.equal(isAdminEmail('eduard.c.t.07@gmail.com'), true);
  assert.equal(isAdminEmail(' Eduard.C.T.07@Gmail.com '), true);
  assert.equal(isAdminEmail('otra@gmail.com'), false);
  assert.equal(isAdminEmail(null), false);
  assert.equal(isAdminEmail(undefined), false);
});
