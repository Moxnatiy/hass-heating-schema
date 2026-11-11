// English and Ukrainian have the same keys and the same placeholders.
import { test } from "node:test";
import assert from "node:assert/strict";

import EN from "../../custom_components/heating_schema/frontend/translations/en.js";
import UK from "../../custom_components/heating_schema/frontend/translations/uk.js";

function flatten(object, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(object)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

const en = flatten(EN);
const uk = flatten(UK);
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("both languages have the same keys", () => {
  assert.deepEqual(Object.keys(uk).sort(), Object.keys(en).sort());
});

test("both languages use the same placeholders", () => {
  for (const key of Object.keys(en)) {
    assert.deepEqual(placeholders(uk[key]), placeholders(en[key]), key);
  }
});

test("no text is empty", () => {
  for (const [key, value] of Object.entries({ ...en, ...uk })) assert.ok(String(value).trim(), key);
});
