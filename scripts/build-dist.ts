import { $ } from "bun";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const entryPoints = [
  "src/syncPipeline.ts",
  "src/index.ts",
  "src/cardSyntax/pluginApi.ts",
  "src/io/vaultAdapter.ts",
  "src/io/nodeVaultAdapter.ts",
  "src/io/inMemoryVaultAdapter.ts",
  "src/utils/pathUtils.ts",
  "src/anki/client.ts",
  "src/config/configParser.ts",
];

await $`bun build ${entryPoints} --outdir dist --root src`;
await mkdir("dist", { recursive: true });
await $`bunx tsc --emitDeclarationOnly --declaration --declarationMap false --outDir dist --rootDir src --module ESNext --target ES2022 --moduleResolution bundler --skipLibCheck --strict false src/index.ts src/syncPipeline.ts src/cardSyntax/pluginApi.ts src/io/vaultAdapter.ts src/io/nodeVaultAdapter.ts src/io/inMemoryVaultAdapter.ts src/utils/pathUtils.ts src/anki/client.ts src/config/configParser.ts`;
console.error(`Built ${entryPoints.length} entry points to dist/`);
