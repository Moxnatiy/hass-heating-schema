// Interface language: English and Ukrainian.
//
// Keys are dotted paths into the dictionaries. A key missing from Ukrainian
// falls back to English, and one missing from both shows the key itself, so
// a gap is visible instead of silent. tests/frontend checks that both
// dictionaries have the same keys.

import EN from "../translations/en.js";
import UK from "../translations/uk.js";

const DICTIONARIES = { en: EN, uk: UK };

let current = EN;

/** Follow Home Assistant's language; anything but Ukrainian is English. */
export function setLanguage(language) {
  const code = String(language || "en").toLowerCase().split(/[-_]/)[0];
  current = DICTIONARIES[code] || EN;
}

function lookup(dictionary, key) {
  let node = dictionary;
  for (const part of key.split(".")) {
    if (node === undefined || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** A translated string, with {name} placeholders filled from vars. */
export function t(key, vars) {
  const text = lookup(current, key) ?? lookup(EN, key) ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** Whether a key exists, for optional texts such as hints. */
export const has = (key) => lookup(current, key) !== undefined || lookup(EN, key) !== undefined;

/** The name of an element type. */
export const elementName = (type) => t(`element.${type}`);

/** The name of a port: numbered ports share one text. */
export function portName(id) {
  const numbered = /^(out|ret|l|r)_?(\d+)$/.exec(id);
  if (numbered) return t(`port.${numbered[1]}_n`, { n: numbered[2] });
  return t(`port.${id}`);
}

/** The name of a binding: numbered loops share one text. */
export function bindingName(key) {
  const loop = /^loop_(\d+)$/.exec(key);
  if (loop) return t("binding.loop_n", { n: loop[1] });
  return t(`binding.${key}`);
}

export const DICTIONARY_KEYS = { en: EN, uk: UK };
