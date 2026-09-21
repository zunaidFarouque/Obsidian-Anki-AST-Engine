export const ANKI_SYNC_COMMENT_REGEX =
	/<!--\s*anki-id(?:\s*:\s*[\s\S]*?|\s*)-->/gi;

const STANDALONE_COMMENT_LINE =
	/^[ \t]*(?:>[ \t]*)*<!--\s*anki-id(?:\s*:\s*[\s\S]*?|\s*)-->[ \t]*$/i;

const INLINE_COMMENT_PATTERN =
	/[ \t]*<!--\s*anki-id(?:\s*:\s*[\s\S]*?|\s*)-->/gi;

/**
 * Removes all Anki sync comments (<!--anki-id: ...-->) from the given text.
 * Strictly preserves other HTML comments (e.g. <!-- note: ... -->) and Obsidian comments (%% ... %%).
 * Cleans up empty lines cleanly without leaving unnecessary blank line gaps.
 */
export function removeAnkiSyncComments(text: string): {
	text: string;
	count: number;
} {
	const totalMatches = text.match(ANKI_SYNC_COMMENT_REGEX);
	if (!totalMatches || totalMatches.length === 0) {
		return { text, count: 0 };
	}

	const isCrlf = text.includes('\r\n');
	const newline = isCrlf ? '\r\n' : '\n';
	const lines = text.split(/\r?\n/);

	const isBlank = (line: string | undefined): boolean =>
		line !== undefined && /^[ \t]*(?:>[ \t]*)*$/.test(line);

	const resultLines: string[] = [];
	let count = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (STANDALONE_COMMENT_LINE.test(line)) {
			count++;
			const prevLine =
				resultLines.length > 0
					? resultLines[resultLines.length - 1]
					: undefined;
			const nextLine = i + 1 < lines.length ? lines[i + 1] : undefined;

			if (isBlank(prevLine) && isBlank(nextLine)) {
				// Drop one of the redundant surrounding blank lines so we don't leave double blank lines
				resultLines.pop();
			}
			continue;
		}

		const lineMatches = line.match(ANKI_SYNC_COMMENT_REGEX);
		if (lineMatches && lineMatches.length > 0) {
			count += lineMatches.length;
			const cleaned = line.replace(INLINE_COMMENT_PATTERN, '');
			resultLines.push(cleaned);
			continue;
		}

		resultLines.push(line);
	}

	return {
		text: resultLines.join(newline),
		count,
	};
}
