import { describe, expect, test } from "bun:test";
import {
	isOutsideScanFolders,
	parseScanFolders,
} from "../../plugin/src/scanFolders";

describe("scanFolders", () => {
	test("isOutsideScanFolders returns false when scan covers entire vault", () => {
		expect(isOutsideScanFolders("Notes/card.md", "")).toBe(false);
	});

	test("isOutsideScanFolders returns true for paths outside configured folders", () => {
		expect(isOutsideScanFolders("Archive/old.md", "Notes, Courses")).toBe(true);
	});

	test("isOutsideScanFolders returns false for paths inside configured folders", () => {
		expect(isOutsideScanFolders("Notes/physics.md", "Notes, Courses")).toBe(
			false,
		);
		expect(
			isOutsideScanFolders("Courses/math/card.md", "Notes, Courses"),
		).toBe(false);
	});

	test("parseScanFolders still defaults to entire vault", () => {
		expect(parseScanFolders("")).toEqual(["."]);
	});
});
