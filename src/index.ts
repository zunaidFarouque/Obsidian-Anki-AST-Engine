import { loadConfig } from "./config/configParser";
import { createAnkiClient } from "./anki/client";
import {
  formatSyncTypeMixLine,
  runSync,
  summarizeSyncActions,
} from "./syncPipeline";

function parseArgs(argv: string[]): {
  dryRun: boolean;
  check: boolean;
  configPath?: string;
} {
  const dryRun = argv.includes("--dry-run");
  const check = argv.includes("--check");
  const configFlagIndex = argv.indexOf("--config");
  const configPath =
    configFlagIndex !== -1 ? argv[configFlagIndex + 1] : undefined;

  return { dryRun, check, configPath };
}

async function main(): Promise<void> {
  const { dryRun, check, configPath } = parseArgs(process.argv.slice(2));
  const config = await loadConfig(configPath);

  if (check) {
    const client = createAnkiClient(config);
    const connected = await client.canConnect();
    if (!connected) {
      console.error("AnkiConnect check failed. Is Anki running?");
      process.exit(1);
    }

    const version = await client.version();
    console.error(`AnkiConnect OK (API version ${version})`);
    return;
  }

  const { actions, duplicateWarnings, mediaWarnings, orphans } = await runSync(config, { dryRun });

  for (const action of actions) {
    console.log(JSON.stringify(action));
  }

  for (const warning of duplicateWarnings) {
    console.error(JSON.stringify({ event: "duplicate_warning", ...warning }));
  }

  for (const warning of mediaWarnings) {
    console.error(JSON.stringify({ event: "media_warning", ...warning }));
  }

  for (const orphan of orphans) {
    console.error(JSON.stringify({ event: "vault_orphan", ...orphan }));
  }

  const summary = summarizeSyncActions(actions);
  const typeMixLine = formatSyncTypeMixLine(summary.typeMix);
  const migrationBits: string[] = [];
  if (summary.typeMigrated > 0) {
    migrationBits.push(`type-migrated ${summary.typeMigrated}`);
  }
  if (summary.modelMismatchBlocked > 0) {
    migrationBits.push(`model-mismatch blocked ${summary.modelMismatchBlocked}`);
  }
  console.error(
    `Sync complete (${dryRun ? "dry-run" : "live"}): ${actions.length} card(s) — added ${summary.added}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}${migrationBits.length > 0 ? `, ${migrationBits.join(", ")}` : ""}; types: ${typeMixLine}${duplicateWarnings.length > 0 ? `; duplicate warning(s) ${duplicateWarnings.length}` : ""}${mediaWarnings.length > 0 ? `; media warning(s) ${mediaWarnings.length}` : ""}${orphans.length > 0 ? `; vault orphan(s) ${orphans.length}` : ""}`,
  );

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
