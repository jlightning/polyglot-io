import assert from 'node:assert/strict';
import test from 'node:test';
import type { Context } from './index';
import { ConfigService } from './configService';

const context = {} as Context;

test('English is enabled for lessons', () => {
  const service = new ConfigService();

  assert.equal(service.isLanguageEnabled(context, 'en'), true);
  assert.ok(
    service
      .getEnabledLanguages(context)
      .some(language => language.code === 'en' && language.name === 'English')
  );
});
