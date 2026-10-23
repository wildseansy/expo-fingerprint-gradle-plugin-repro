// Reads `npx @expo/fingerprint fingerprint:generate` JSON from stdin and prints a one-line summary.
let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const fingerprint = JSON.parse(input);
  const count = (reason) =>
    fingerprint.sources.filter((source) => source.reasons.includes(reason)).length;
  console.log(
    JSON.stringify({
      hash: fingerprint.hash,
      expoAutolinkingAndroidSources: count('expoAutolinkingAndroid'),
      expoAutolinkingIosSources: count('expoAutolinkingIos'),
    })
  );
});
