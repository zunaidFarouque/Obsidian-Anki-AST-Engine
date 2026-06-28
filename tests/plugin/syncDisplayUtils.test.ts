import { describe, expect, test } from "bun:test";
import {
	basename,
	duplicateWarningLabel,
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
});
