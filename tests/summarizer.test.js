const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { summarizeUnreadEmails } = require('../src/lib/summarizer');

const fixturesDir = path.join(__dirname, 'fixtures');
const fixtureFiles = [
  'no-unread-emails.json',
  'mixed-categories.json',
  'long-snippet-truncation.json',
  'duplicate-thread-ids.json',
];

for (const fixtureFile of fixtureFiles) {
  test(`summarizeUnreadEmails fixture: ${fixtureFile}`, () => {
    const fixturePath = path.join(fixturesDir, fixtureFile);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    const result = summarizeUnreadEmails(fixture.input, fixture.options);

    assert.deepStrictEqual(result, fixture.expected);
  });
}
