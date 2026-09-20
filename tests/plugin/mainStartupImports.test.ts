import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('plugin/src/main.ts startup imports', () => {
	it('does not eagerly import heavy AST or command modules at top level', () => {
		const mainPath = resolve('plugin/src/main.ts');
		const content = readFileSync(mainPath, 'utf8');

		// Extract top-level import statements (ignoring type-only imports)
		const lines = content.split('\n');
		const topLevelValueImports: string[] = [];

		let inImport = false;
		let currentImport = '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith('import ') && !trimmed.startsWith('import type ')) {
				if (trimmed.includes('from ')) {
					topLevelValueImports.push(trimmed);
				} else {
					inImport = true;
					currentImport = trimmed;
				}
			} else if (inImport) {
				currentImport += ' ' + trimmed;
				if (trimmed.includes('from ')) {
					topLevelValueImports.push(currentImport);
					inImport = false;
					currentImport = '';
				}
			}
		}

		// Ensure heavy modules are NOT in top-level value imports
		const forbiddenModules = [
			'navigation/cardNavigation',
			'helpers/cardTemplates',
			'helpers/noteHelpers',
			'commentCleaner',
			'obsidian-anki-ast-engine/cardSyntax',
			'obsidian-anki-ast-engine/anki',
		];

		for (const forbidden of forbiddenModules) {
			const matched = topLevelValueImports.find((imp) =>
				imp.includes(forbidden),
			);
			expect(matched).toBeUndefined();
		}
	});
});
