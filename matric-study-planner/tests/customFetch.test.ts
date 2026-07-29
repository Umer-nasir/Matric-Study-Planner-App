import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  ApiError,
  ResponseParseError,
  customFetch,
  setAuthTokenGetter,
  setBaseUrl,
} from '../lib/api-client-react/src/custom-fetch.ts';

afterEach(() => {
  setBaseUrl(null);
  setAuthTokenGetter(null);
});

test('throws ApiError with parsed JSON error bodies', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: 'Invalid schedule request' }), {
      status: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'application/json' },
    });

  await assert.rejects(
    customFetch('/api/generate-schedule', { responseType: 'json' }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.deepEqual(error.data, { message: 'Invalid schedule request' });
      assert.match(error.message, /Invalid schedule request/);
      return true;
    },
  );
});

test('throws ApiError with HTML error bodies as text instead of JSON parse errors', async () => {
  globalThis.fetch = async () =>
    new Response('<!doctype html><title>Server Error</title>', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

  await assert.rejects(
    customFetch('/api/tutor-chat', { responseType: 'json' }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 502);
      assert.equal(error.data, '<!doctype html><title>Server Error</title>');
      assert.match(error.message, /Server Error/);
      return true;
    },
  );
});

test('throws ResponseParseError for successful JSON responses that contain HTML', async () => {
  globalThis.fetch = async () =>
    new Response('<!doctype html><title>Login</title>', {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
    });

  await assert.rejects(
    customFetch('/api/explain-chapter', { responseType: 'json' }),
    (error) => {
      assert.ok(error instanceof ResponseParseError);
      assert.equal(error.status, 200);
      assert.match(error.rawBody, /Login/);
      return true;
    },
  );
});
