# expo-fingerprint-gradle-plugin-repro

Minimal reproduction for an `@expo/fingerprint` bug: when an Expo module declares an Android gradle plugin that is resolved from Maven (no `sourceDir`), the Android fingerprint loses **all** Expo module sources. `expo-widgets` declares such a plugin.

This app is `npx create-expo-app@latest --template blank` plus `npx expo install expo-widgets`. The only additions are two helper scripts in `scripts/`:

- `scripts/summarize-fingerprint.js` reads the fingerprint JSON from stdin and prints the hash and the number of sources with the `expoAutolinkingAndroid` and `expoAutolinkingIos` reasons.
- `scripts/toggle-guard.js` adds (or with `--revert`, removes) the proposed one-line fix in the installed `@expo/fingerprint` build, so the result can be compared with and without it.

Versions: `expo@58.0.17`, `expo-widgets@58.0.22`, `@expo/fingerprint@0.21.6`, `expo-modules-autolinking@58.0.14`, Node 22.22.1, npm 11.19.1, macOS.

## Steps

### 1. Install

```sh
npm install
```

Autolinking returns the `expo-widgets` gradle plugin without a `sourceDir`:

```sh
npx expo-modules-autolinking resolve -p android --json
```

The `expo-widgets` entry contains:

```json
"plugins": [{ "id": "io.github.expo.peek.glance-fork", "group": "io.github.expo.peek", "version": "0.3.2" }]
```

### 2. Generate the fingerprint for each platform

```sh
npx @expo/fingerprint fingerprint:generate --platform android | node scripts/summarize-fingerprint.js
npx @expo/fingerprint fingerprint:generate --platform ios | node scripts/summarize-fingerprint.js
```

Observed:

```
{"hash":"3c4dbab5e56d8cb7b4f3accd1f8d6a79bec96033","expoAutolinkingAndroidSources":0,"expoAutolinkingIosSources":0}
{"hash":"d92fe8ba03c5413f525c7c68eba7439febb6cdaa","expoAutolinkingAndroidSources":0,"expoAutolinkingIosSources":14}
```

Expected: Android has one source per autolinked Expo module plus the `expoAutolinkingConfig:android` contents source, like iOS. Actual: Android has none.

### 3. Change an Expo module version (default `balanced` preset)

```sh
npx @expo/fingerprint fingerprint:generate --platform android | node scripts/summarize-fingerprint.js
npm install expo-status-bar@58.0.3 --no-save
npx @expo/fingerprint fingerprint:generate --platform android | node scripts/summarize-fingerprint.js
npm install   # restore expo-status-bar@58.0.4
```

Observed: the Android hash does not change.

```
{"hash":"3c4dbab5e56d8cb7b4f3accd1f8d6a79bec96033","expoAutolinkingAndroidSources":0,...}
{"hash":"3c4dbab5e56d8cb7b4f3accd1f8d6a79bec96033","expoAutolinkingAndroidSources":0,...}
```

### 4. Edit an Expo module's Kotlin source (`strict` preset)

The `strict` preset hashes native module files instead of package versions.

```sh
npx @expo/fingerprint fingerprint:generate --platform android --preset strict | node scripts/summarize-fingerprint.js
echo '// edit' >> node_modules/expo-modules-core/android/src/main/java/expo/modules/apploader/AppLoaderProvider.kt
npx @expo/fingerprint fingerprint:generate --platform android --preset strict | node scripts/summarize-fingerprint.js
```

Observed: the Android hash does not change.

```
{"hash":"04fde972dffcfa401601d09f3b1554422b21d204","expoAutolinkingAndroidSources":0,...}
{"hash":"04fde972dffcfa401601d09f3b1554422b21d204","expoAutolinkingAndroidSources":0,...}
```

Revert the edit with `npm install --force` or by removing the added line.

### 5. Apply the proposed fix and repeat

```sh
node scripts/toggle-guard.js
```

Then repeat steps 3 and 4. Observed:

| Case | `expoAutolinkingAndroid` sources | Hash |
| --- | --- | --- |
| Default preset, `expo-status-bar@58.0.4` | 13 | `ef03649a…` |
| Default preset, `expo-status-bar@58.0.3` | 13 | `3186e482…` (changed) |
| `strict` preset | 14 | `3b11d1ab…` |
| `strict` preset, after the `.kt` edit | 14 | `a0fa2d27…` (changed) |

Remove the fix with `node scripts/toggle-guard.js --revert`.

### Control

With the fix removed, deleting the `gradlePlugins` entry from `node_modules/expo-widgets/expo-module.config.json` also brings back 13 Android sources. The gradle plugin without a `sourceDir` is the trigger.

## Cause

`getExpoAutolinkingAndroidSourcesAsync` in `@expo/fingerprint` calls `path.relative(projectRoot, plugin.sourceDir)` for each gradle plugin. For a plugin resolved from Maven, `sourceDir` is `undefined`, so `path.relative` throws a `TypeError`. The function catches every error and returns `[]`, which drops all Android Expo module sources and the autolinking config contents source.
