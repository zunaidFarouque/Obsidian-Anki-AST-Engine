import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'shims',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			'obsidianmd/ui/sentence-case': [
				'warn',
				{
					brands: ['Anki', 'AnkiConnect', 'Obsidian', 'Markdown', 'LaTeX', 'MathJax', 'CodeMirror'],
					acronyms: ['AST', 'URL', 'API', 'CORS', 'UUID', 'CSS', 'HTML', 'GFM', 'ID'],
					ignoreWords: [
						'requestUrl',
						'AnkiSync',
						'ankisync',
						'target_anki_deck',
						'target_Anki_deck',
						'apiKey',
						'apikey',
						':::r',
						':::t',
						'c1',
						'cN',
						'Basic',
						'Cloze',
						'Reversible',
						'Typed',
					],
				},
			],
		},
	},
);
