import { loadConfig } from "./config/configParser";
import { runSync } from "./syncPipeline";

function parseArgs(argv: string[]): { dryRun: boolean; configPath?: string } {
  const dryRun = argv.includes("--dry-run");
  const configFlagIndex = argv.indexOf("--config");
  const configPath =
    configFlagIndex !== -1 ? argv[configFlagIndex + 1] : undefined;

  return { dryRun, configPath };
}

async function main(): Promise<void> {
  const { dryRun, configPath } = parseArgs(process.argv.slice(2));
  const config = await loadConfig(configPath);
  const actions = await runSync(config, { dryRun });

  for (const action of actions) {
    console.log(JSON.stringify(action));
  }

  console.error(
    `Sync complete (${dryRun ? "dry-run" : "live"}): ${actions.length} card(s) processed`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
