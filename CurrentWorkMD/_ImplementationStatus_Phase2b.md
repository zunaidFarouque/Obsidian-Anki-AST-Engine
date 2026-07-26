# Implementation Status — Phase 2b

**Date:** 2026-07-15  
**Goal:** `inferClozeFromManualSyntaxOnBasic` on preview **and** sync; auto-create stock Anki note types with opt-out.  
**Prior:** `_ImplementationStatus_Phase2.md`  
**Decisions:** 01 D4, 02 D5, 05 D4; DECIDED contract §1 / §2.4  

## Landed this phase

1. **`inferClozeFromManualSyntaxOnBasic` sync parity**
   - Config field `inferClozeFromManualSyntaxOnBasic` (default `false`)
   - `syncPipeline` passes it into `parseCardDocument` (was hardcoded `false`)
   - Plugin settings + `configBuilder` wire the toggle through
   - Setting description updated: preview **and** sync

2. **Auto-create stock note types** (`autoCreateStockNoteModels`, default `true`)
   - `AnkiConnectClient.createModel`
   - `stockModelCreateParams` for Basic / Cloze / Basic (and reversed card) / Basic (type in the answer)
   - `modelEnsurer` (mirror of `deckEnsurer`) — creates stock only; non-stock → clear error
   - Wired in `syncEngine` / `createSyncRunContext` before add/update
   - Plugin settings toggle to **opt out**

3. **TYP-03b** — formatting-in-typed-answer warn uses `TYP-03b` (TYP-05 reserved for multi-answer)

## Tests

| Suite | Result |
| ----- | ------ |
| `bun test tests/syncPipeline.phase2b.test.ts` | **4 pass** |
| `bun test tests/anki/modelEnsurer.test.ts` | **5 pass** |
| `bun test tests/syncPipeline.multiType.phase2.test.ts` | **6 pass** (regression) |
| `bun test tests/syncPipeline.test.ts` | **18 pass** (regression) |
| Related: syncEngine / configParser / configBuilder / parseCardDocument TYP-03b | pass |

## Explicitly not in Phase 2b (next)

| Phase | Work |
| ----- | ---- |
| **2c** | TYP-05 multi-answer pipe parsing; model migration summary counts / pre-sync UI (partial engine migration land may already exist — finish summary surfaces) |
| **3** | Custom note type sync (payload + Anki fields) |
| **4** | Polish / remapping UI / stress-matrix expansion |
