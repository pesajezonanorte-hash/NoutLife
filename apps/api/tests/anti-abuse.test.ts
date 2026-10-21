import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickSpacedCheckins, referralVerdict, sharesDevice } from '../src/lib/referrals';

const HOUR = 60 * 60_000;
const at = (iso: string) => new Date(iso);

test('three completions on the same day are one check-in, not three', () => {
  const logs = [
    { day: '2026-10-20', at: at('2026-10-20T08:00:00.000Z') },
    { day: '2026-10-20', at: at('2026-10-20T20:00:00.000Z') },
    { day: '2026-10-20', at: at('2026-10-20T23:00:00.000Z') },
  ];
  assert.equal(pickSpacedCheckins(logs), 1);
});

test('three distinct days, each at least 12 hours apart, count as three check-ins', () => {
  const logs = [
    { day: '2026-10-20', at: at('2026-10-20T09:00:00.000Z') },
    { day: '2026-10-21', at: at('2026-10-21T09:00:00.000Z') },
    { day: '2026-10-22', at: at('2026-10-22T09:00:00.000Z') },
  ];
  assert.equal(pickSpacedCheckins(logs), 3);
});

test('a check-in less than 12 hours after the last counted one does not count', () => {
  const logs = [
    { day: '2026-10-20', at: at('2026-10-20T09:00:00.000Z') },
    // Otro día, pero a solo 5 h: no cuenta.
    { day: '2026-10-21', at: at('2026-10-20T14:00:00.000Z') },
    { day: '2026-10-22', at: at('2026-10-22T09:00:00.000Z') },
  ];
  assert.equal(pickSpacedCheckins(logs), 2);
});

test('the order of the input does not matter: the earliest valid check-ins are chosen', () => {
  const logs = [
    { day: '2026-10-22', at: at('2026-10-22T09:00:00.000Z') },
    { day: '2026-10-20', at: at('2026-10-20T09:00:00.000Z') },
    { day: '2026-10-21', at: at('2026-10-21T09:00:00.000Z') },
  ];
  assert.equal(pickSpacedCheckins(logs), 3);
  assert.equal(pickSpacedCheckins(logs.slice(0, 2), 3, 12 * HOUR), 2);
});

test('a same-device pair is shared; disjoint or empty device lists are not', () => {
  assert.equal(sharesDevice(['dev-a-1234567890', 'dev-b-1234567890'], ['dev-b-1234567890']), true);
  assert.equal(sharesDevice(['dev-a-1234567890'], ['dev-c-1234567890']), false);
  assert.equal(sharesDevice([], ['dev-c-1234567890']), false);
  assert.equal(sharesDevice(['dev-a-1234567890'], []), false);
});

test('a self-referral on the same device is flagged even when every usage requirement is met', () => {
  const verdict = referralVerdict({ flagged: false, sharedDevice: true, spacedCheckins: 3, spaceInteraction: true });
  assert.equal(verdict, 'flag');
});

test('a flagged referral never activates, whatever the usage looks like', () => {
  assert.equal(referralVerdict({ flagged: true, sharedDevice: false, spacedCheckins: 3, spaceInteraction: true }), 'flag');
});

test('the reward needs both 3 spaced check-ins and one real use of a space', () => {
  assert.equal(referralVerdict({ flagged: false, sharedDevice: false, spacedCheckins: 3, spaceInteraction: false }), 'wait');
  assert.equal(referralVerdict({ flagged: false, sharedDevice: false, spacedCheckins: 2, spaceInteraction: true }), 'wait');
  assert.equal(referralVerdict({ flagged: false, sharedDevice: false, spacedCheckins: 3, spaceInteraction: true }), 'activate');
});
