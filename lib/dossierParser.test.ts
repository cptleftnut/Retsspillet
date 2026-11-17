import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDossierText, DEMO_CUSTOM_DOSSIER } from './dossierParser';

test('parseDossierText parses demo custom dossier into playable LegalCase', () => {
  const result = parseDossierText(DEMO_CUSTOM_DOSSIER, 'demo.txt');
  const c = result.legalCase;

  assert.equal(c.title, 'Kunsttyveriet på Glyptoteket');
  assert.equal(c.caseNumber, '#KUNST-882');
  assert.ok(c.charge.includes('§ 276a'));
  assert.equal(c.defendantName, 'Emilie Vestergaard');
  assert.equal(c.evidence.length, 4);
  assert.equal(c.witnesses.length, 1);

  // Check exhibits
  const bilagA = c.evidence.find((e) => e.title.includes('Bilag A'));
  assert.ok(bilagA);
  assert.equal(bilagA.type, 'technical');
  assert.equal(bilagA.reliabilityWeight >= 8, true);

  const bilagD = c.evidence.find((e) => e.title.includes('Bilag D'));
  assert.ok(bilagD);
  assert.equal(bilagD.isIrrelevant, true);

  // Check witness
  const witness = c.witnesses[0];
  assert.equal(witness.name, 'Lars Brixen');
  assert.equal(witness.roleTitle, 'Natvægter');
});

test('parseDossierText handles raw plain text and builds fallbacks gracefully', () => {
  const raw = `Politirapport angående butikstyveri på Strøget.
En mand i grøn jakke forlod butikken uden at betale for en jakke.
Kvitteringen manglede ved kassen kl. 14:15.`;

  const result = parseDossierText(raw, 'politirapport_stroget.txt');
  const c = result.legalCase;

  assert.ok(c.title.length > 0);
  assert.ok(c.evidence.length >= 1);
  assert.equal(c.source, 'Egen sag');
});
