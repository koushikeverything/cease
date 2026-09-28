/** Relaunch and repeat-offender tests — SPEC R32, R33, A14. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchRelaunch, findRelaunch, repeatOffenders } from '../scripts/relaunch.mjs';

const CLOSED = {
  caseId: 'c-0001',
  closedAt: '2026-09-01T00:00:00Z',
  subject: { domain: 'lumengoods-outlet.example', seller: 'Lumen Goods Outlet Store' },
  matchedPhrases: ['hand-spun brushed brass shade with'],
  imageHashes: ['a'.repeat(64)],
  registrantEmail: 'admin@privacyguard.example',
  nameservers: ['ns1.cheaphost.example', 'ns2.cheaphost.example'],
  price: 78,
};

describe('A14 — a relaunch under a new domain is caught', () => {
  test('same copy and same seller, new domain, opens a linked case [A14]', () => {
    const hit = {
      id: 'lst_003', domain: 'halo-lighting-sale.example', seller: 'Lumen Goods Outlet Store',
      matchedPhrases: ['hand-spun brushed brass shade with'], price: 74,
    };
    const m = matchRelaunch(hit, CLOSED);
    assert.equal(m.confidence, 'high');
    assert.equal(m.parentCase, 'c-0001', 'a relaunch must link to its parent case');
    assert.ok(m.reasons.some((r) => /identical product copy/.test(r)));
  });

  test('matching survives a changed seller name if the copy and registrant persist [R32]', () => {
    const hit = {
      domain: 'brass-pendant-deals.example', seller: 'Bright Home Supplies',
      matchedPhrases: ['hand-spun brushed brass shade with'],
      registrantEmail: 'ADMIN@privacyguard.example',
    };
    const m = matchRelaunch(hit, CLOSED);
    assert.ok(m.score >= 55, `expected high confidence, got ${m.score}`);
    assert.ok(m.reasons.some((r) => /registrant/.test(r)));
  });

  test('an unrelated listing is not a relaunch [R32]', () => {
    const m = matchRelaunch({ domain: 'someothershop.example', seller: 'Different Co', matchedPhrases: ['nothing alike'] }, CLOSED);
    assert.equal(m.confidence, 'none');
    assert.equal(m.parentCase, null);
  });

  test('the SAME domain is a failed takedown, not a relaunch [R32]', () => {
    // Different facts, different next action: one escalates, the other opens a case.
    const m = matchRelaunch({ domain: 'lumengoods-outlet.example', seller: 'Lumen Goods Outlet Store' }, CLOSED);
    assert.equal(m.notARelaunch, true);
    assert.equal(m.parentCase, null);
    assert.match(m.reasons[0], /failed takedown/);
  });
});

describe('the 90-day watch window [R32]', () => {
  const hit = { domain: 'new.example', seller: 'Lumen Goods Outlet Store', matchedPhrases: ['hand-spun brushed brass shade with'] };

  test('a case closed inside the window still matches', () => {
    assert.ok(findRelaunch(hit, [CLOSED], { now: new Date('2026-10-15T00:00:00Z') }));
  });
  test('a case closed outside the window is no longer watched', () => {
    assert.equal(findRelaunch(hit, [CLOSED], { now: new Date('2027-06-01T00:00:00Z') }), null);
  });
});

describe('R33 — repeat offenders accumulate a dossier', () => {
  test('a seller with two or more cases is surfaced with every domain', () => {
    const cases = [
      { caseId: 'c-1', subject: { seller: 'Lumen Goods Outlet Store', domain: 'a.example' } },
      { caseId: 'c-2', subject: { seller: 'lumen goods outlet store', domain: 'b.example' } },
      { caseId: 'c-3', subject: { seller: 'Someone Else', domain: 'c.example' } },
    ];
    const r = repeatOffenders(cases);
    assert.equal(r.length, 1, 'only the repeat offender qualifies');
    assert.equal(r[0].count, 2);
    assert.deepEqual(r[0].domains.sort(), ['a.example', 'b.example']);
  });

  test('a one-off is not a repeat offender', () => {
    assert.deepEqual(repeatOffenders([{ caseId: 'c-1', subject: { seller: 'Only Once' } }]), []);
  });
});
