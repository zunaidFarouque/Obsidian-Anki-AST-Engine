import { requestUrl } from 'obsidian';

function resolveUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') {
		return input;
	}

	if (input instanceof URL) {
		return input.href;
	}

	return input.url;
}

function normalizeHeaders(init?: RequestInit): Record<string, string> {
	const headers: Record<string, string> = {};
	if (!init?.headers) {
		return headers;
	}

	if (init.headers instanceof Headers) {
		init.headers.forEach((value, key) => {
			headers[key] = value;
		});
		return headers;
	}

	if (Array.isArray(init.headers)) {
		for (const [key, value] of init.headers) {
			headers[key] = value;
		}
		return headers;
	}

	return { ...init.headers };
}

/**
 * Obsidian's requestUrl bypasses browser CORS. Use this instead of fetch for AnkiConnect.
 */
export function createObsidianFetch(): typeof fetch {
	const obsidianFetch = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const url = resolveUrl(input);
		const method = init?.method ?? 'GET';
		const headers = normalizeHeaders(init);
		const body =
			typeof init?.body === 'string'
				? init.body
				: init?.body !== undefined
					? String(init.body)
					: undefined;

		const result = await requestUrl({
			url,
			method,
			body,
			headers,
			contentType:
				headers['Content-Type'] ??
				headers['content-type'] ??
				'application/json',
			throw: false,
		});

		return new Response(result.text, {
			status: result.status,
			headers: result.headers,
		});
	};

	return obsidianFetch as typeof fetch;
}
