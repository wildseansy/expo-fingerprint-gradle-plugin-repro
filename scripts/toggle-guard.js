// Adds (or with --revert, removes) the proposed `sourceDir` guard in the installed
// @expo/fingerprint build, so the fingerprint can be compared with and without the fix.
const fs = require('fs');

const file = require.resolve('@expo/fingerprint/build/sourcer/Expo.js');
const loop = 'for (const plugin of module1.plugins){';
const guard = ' if (plugin.sourceDir == null) { continue; }';
let source = fs.readFileSync(file, 'utf8');

if (!source.includes(loop)) {
  throw new Error(`Cannot find the plugins loop in ${file}. This script targets @expo/fingerprint 0.21.x.`);
}
if (process.argv.includes('--revert')) {
  source = source.replace(loop + guard, loop);
  console.log('Guard removed.');
} else if (!source.includes(loop + guard)) {
  source = source.replace(loop, loop + guard);
  console.log('Guard added.');
} else {
  console.log('Guard already present.');
}
fs.writeFileSync(file, source);
