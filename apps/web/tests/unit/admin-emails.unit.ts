import test from 'node:test';
import assert from 'node:assert/strict';
import { emailsToClipboardText, uniqueEmails } from '../../src/lib/admin-emails';

test('uniqueEmails trims, drops empties and dedupes case-insensitively keeping order', () => {
  assert.deepEqual(
    uniqueEmails([' ana@correo.com ', '', 'beto@correo.com', 'ANA@correo.com', '  ', 'beto@correo.com']),
    ['ana@correo.com', 'beto@correo.com'],
  );
  assert.deepEqual(uniqueEmails([]), []);
});

test('emailsToClipboardText joins with commas, ready to paste into an email client', () => {
  assert.equal(
    emailsToClipboardText(['ana@correo.com', 'beto@correo.com', 'ana@correo.com']),
    'ana@correo.com, beto@correo.com',
  );
  assert.equal(emailsToClipboardText(['ana@correo.com']), 'ana@correo.com');
  assert.equal(emailsToClipboardText([]), '');
});
