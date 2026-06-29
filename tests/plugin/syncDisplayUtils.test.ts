import { describe, expect, test } from "bun:test";
import {
	basename,
	duplicateWarningLabel,
	formatOrphanDeckMeta,
	formatOrphanFrontPreview,
	formatOrphanUuidHint,
	truncate,
} from "../../plugin/src/ui/syncDisplayUtils";

describe("syncDisplayUtils", () => {
	test("basename returns final path segment", () => {
		expect(basename("Notes/physics/entropy.md")).toBe("entropy.md");
		expect(basename("C:\\Vault\\Notes\\card.md")).toBe("card.md");
	});

	test("truncate shortens long strings", () => {
		expect(truncate("hello", 10)).toBe("hello");
		expect(truncate("hello world", 8)).toBe("hello w…");
	});

	test("duplicateWarningLabel maps warning kinds", () => {
		expect(
			duplicateWarningLabel({
				kind: "back_mismatch",
				deck: "D",
				frontHtml: "",
				message: "",
				sources: [],
			}),
		).toBe("Duplicate front with different backs");
		expect(
			duplicateWarningLabel({
				kind: "vault_front_collision",
				deck: "D",
				frontHtml: "",
				message: "",
				sources: [],
			}),
		).toBe("Duplicate front collision");
	});

	test("formatOrphanFrontPreview prefers preview fields and strips html", () => {
		expect(
			formatOrphanFrontPreview({
				ankiNoteId: 42,
				uuid: "u-42",
				preview: "What is entropy?",
			}),
		).toBe("What is entropy?");
		expect(
			formatOrphanFrontPreview({
				ankiNoteId: 42,
				uuid: "u-42",
				frontHtml: "<b>What is entropy?</b>",
			}),
		).toBe("What is entropy?");
		expect(
			formatOrphanFrontPreview({
				ankiNoteId: 42,
				uuid: "u-42",
				preview:
					"<style>.card { font-size: 20px; }</style><p>What is a visa?</p>",
			}),
		).toBe("What is a visa?");
		expect(
			formatOrphanFrontPreview({
				ankiNoteId: 42,
				uuid: "u-42",
				frontPreview: "Define osmosis.",
			}),
		).toBe("Define osmosis.");
	});

	test("formatOrphanFrontPreview falls back to friendly note id text", () => {
		expect(
			formatOrphanFrontPreview({
				ankiNoteId: 9001,
				uuid: "u-9001",
			}),
		).toBe("Orphaned note 9001");
	});

	test("formatOrphanDeckMeta returns friendly default when missing", () => {
		expect(formatOrphanDeckMeta({ ankiNoteId: 1, uuid: "u-1", deck: "Biology" })).toBe(
			"Biology",
		);
		expect(formatOrphanDeckMeta({ ankiNoteId: 1, uuid: "u-1" })).toBe("Deck unknown");
	});

	test("formatOrphanUuidHint renders uuid hint text", () => {
		expect(formatOrphanUuidHint({ ankiNoteId: 1, uuid: "abc-uuid" })).toBe(
			"UUID: abc-uuid",
		);
	});
});
