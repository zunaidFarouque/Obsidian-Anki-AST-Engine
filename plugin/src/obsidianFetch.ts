import { requestUrl } from 'obsidian';
import type { FetchLike } from 'obsidian-anki-ast-engine/anki';

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
export function createObsidianFetch(): FetchLike {
	const obsidianFetch: FetchLike = async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		const url = resolveUrl(input);
		const method = init?.method ?? 'GET';
		const headers = normalizeHeaders(init);
		let body: string | ArrayBuffer | undefined;
		if (typeof init?.body === 'string') {
			body = init.body;
		} else if (init?.body instanceof ArrayBuffer) {
			body = init.body;
		} else if (init?.body !== undefined && init?.body !== null) {
			body = JSON.stringify(init.body);
		}

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

	return obsidianFetch;
}
