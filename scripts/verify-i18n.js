const fs = require('fs');
const path = require('path');

const esPath = path.join(__dirname, '../src/i18n/locales/es.json');
const enPath = path.join(__dirname, '../src/i18n/locales/en.json');

const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const esKeys = getKeys(es).sort();
const enKeys = getKeys(en).sort();

const missingInEn = esKeys.filter((k) => !enKeys.includes(k));
const missingInEs = enKeys.filter((k) => !esKeys.includes(k));

let hasErrors = false;

if (missingInEn.length > 0) {
  console.error('❌ Keys in es.json but missing in en.json:', missingInEn);
  hasErrors = true;
}

if (missingInEs.length > 0) {
  console.error('❌ Keys in en.json but missing in es.json:', missingInEs);
  hasErrors = true;
}

if (!hasErrors) {
  console.log(`✅ i18n parity check passed! All ${esKeys.length} translation keys are synchronized between es.json and en.json.`);
  process.exit(0);
} else {
  process.exit(1);
}
