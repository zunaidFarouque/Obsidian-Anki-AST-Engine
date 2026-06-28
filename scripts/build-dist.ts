import { $ } from "bun";

const entryPoints = [
  "src/syncPipeline.ts",
  "src/index.ts",
  "src/io/vaultAdapter.ts",
  "src/io/nodeVaultAdapter.ts",
  "src/io/inMemoryVaultAdapter.ts",
  "src/utils/pathUtils.ts",
  "src/anki/client.ts",
  "src/config/configParser.ts",
];

await $`bun build ${entryPoints} --outdir dist --root src`;
console.error(`Built ${entryPoints.length} entry points to dist/`);
