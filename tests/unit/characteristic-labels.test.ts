// Гард перевода характеристик: каждый лейбл из чипов-пресетов и сидовых
// товаров обязан иметь ключ в CHARACTERISTIC_LABEL_KEYS и непустой перевод
// specLabels.* во всех трёх локалях (ru — тождественный лейблу).
// Новый лейбл в пресетах/сидах без перевода роняет этот тест — так дрейф
// между characteristicPresets, серверными сидами и i18n-словарями не доезжает
// до витрины непереведённым.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CHARACTERISTIC_LABEL_KEYS } from '../../app/utils/characteristicLabels';
import { presetLabelsForCategories } from '../../app/utils/characteristicPresets';

const root = fileURLToPath(new URL('../..', import.meta.url));

const locales = Object.fromEntries(
  (['ru', 'en', 'es'] as const).map((loc) => [
    loc,
    JSON.parse(readFileSync(`${root}/i18n/locales/${loc}.json`, 'utf8')),
  ]),
) as Record<'ru' | 'en' | 'es', { specLabels: Record<string, string> }>;

// Лейблы всех сидовых товаров (то, что реально показывает витрина)
const seedLabels = new Set<string>();
for (const product of JSON.parse(readFileSync(`${root}/server/data/products.json`, 'utf8'))) {
  for (const label of Object.keys(product.characteristics ?? {})) seedLabels.add(label);
}

// Лейблы чипов-пресетов редактора (универсальные + все категорийные)
const presetLabels = new Set(presetLabelsForCategories([]));
for (const category of ['Смартфоны', 'Одежда', 'Кухня', 'Освещение', 'Книги']) {
  for (const label of presetLabelsForCategories([category])) presetLabels.add(label);
}

// Чисто латинские лейблы (GPS, NFC, Wi-Fi) в en/es могут совпадать с русским
// написанием — для них тождественный перевод легитимен
const isLatinOnly = (label: string) => /^[\x20-\x7E]+$/.test(label);

describe('перевод характеристик: карта лейблов ↔ словари specLabels', () => {
  it('каждый лейбл сидов и пресетов имеет ключ в CHARACTERISTIC_LABEL_KEYS', () => {
    const missing = [...seedLabels, ...presetLabels].filter(
      (label) => !CHARACTERISTIC_LABEL_KEYS[label],
    );
    expect(missing).toEqual([]);
  });

  it('каждый ключ карты есть во всех локалях; в ru — тождественен лейблу', () => {
    for (const [label, key] of Object.entries(CHARACTERISTIC_LABEL_KEYS)) {
      for (const loc of ['ru', 'en', 'es'] as const) {
        expect(locales[loc].specLabels[key], `${loc}.specLabels.${key}`).toBeTruthy();
      }
      expect(locales.ru.specLabels[key], label).toBe(label);
    }
  });

  it('словари не содержат лишних ключей (мусор не копится)', () => {
    const expected = Object.values(CHARACTERISTIC_LABEL_KEYS).sort();
    for (const loc of ['ru', 'en', 'es'] as const) {
      expect(Object.keys(locales[loc].specLabels).sort()).toEqual(expected);
    }
  });

  it('кириллические лейблы реально переведены (не скопирован русский текст)', () => {
    for (const [label, key] of Object.entries(CHARACTERISTIC_LABEL_KEYS)) {
      if (isLatinOnly(label)) continue;
      expect(locales.en.specLabels[key], `en: ${label}`).not.toBe(label);
      expect(locales.es.specLabels[key], `es: ${label}`).not.toBe(label);
    }
  });
});
