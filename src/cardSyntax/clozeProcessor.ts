export type ClozeProcessOptions = {
  allowShorthand: boolean;
};

export type ClozeProcessResult = {
  text: string;
  valid: boolean;
  warnings: string[];
};

type ParsedCloze =
  | {
      kind: "manual";
      number: number;
      text: string;
      hint?: string;
      raw: string;
      start: number;
      end: number;
    }
  | {
      kind: "auto";
      text: string;
      hint?: string;
      raw: string;
      start: number;
      end: number;
    };

const CLOZE_PATTERN = /\{\{([^}]*)\}\}/g;

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function splitTextAndHint(content: string): { text: string; hint?: string } {
  const separator = content.indexOf("::");
  if (separator === -1) {
    return { text: content };
  }

  return {
    text: content.slice(0, separator),
    hint: content.slice(separator + 2),
  };
}

function parseManualInner(
  inner: string,
  raw: string,
  start: number,
  end: number,
): ParsedCloze | null {
  const match = /^c(\d+)::(.*)$/s.exec(inner);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  const { text, hint } = splitTextAndHint(match[2]!);

  return {
    kind: "manual",
    number,
    text,
    hint,
    raw,
    start,
    end,
  };
}

function parseAutoInner(
  inner: string,
  raw: string,
  start: number,
  end: number,
): ParsedCloze {
  const { text, hint } = splitTextAndHint(inner);

  return {
    kind: "auto",
    text,
    hint,
    raw,
    start,
    end,
  };
}

function findClozeMatches(
  text: string,
  allowShorthand: boolean,
): ParsedCloze[] {
  const matches: ParsedCloze[] = [];

  for (const match of text.matchAll(CLOZE_PATTERN)) {
    const raw = match[0]!;
    const inner = match[1]!;
    const start = match.index!;
    const end = start + raw.length;

    const manual = parseManualInner(inner, raw, start, end);
    if (manual) {
      matches.push(manual);
      continue;
    }

    if (allowShorthand) {
      matches.push(parseAutoInner(inner, raw, start, end));
    }
  }

  return matches;
}

function smallestUnusedNumber(used: Set<number>): number {
  let candidate = 1;
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

function formatCloze(number: number, text: string, hint?: string): string {
  if (hint !== undefined && hint.length > 0) {
    return `{{c${number}::${text}::${hint}}}`;
  }
  return `{{c${number}::${text}}}`;
}

function assignNumbers(matches: ParsedCloze[]): {
  assignments: Map<ParsedCloze, { number: number; hint?: string }>;
  warnings: string[];
} {
  const warnings: string[] = [];
  const usedNumbers = new Set<number>();
  const normalizedToNumber = new Map<string, number>();
  const autoGroupNumbers = new Map<string, number>();
  const groupHints = new Map<number, string | undefined>();
  const assignments = new Map<ParsedCloze, { number: number; hint?: string }>();

  for (const match of matches) {
    if (match.kind === "manual") {
      usedNumbers.add(match.number);
      const normalized = normalizeText(match.text);
      if (normalized.length > 0 && !normalizedToNumber.has(normalized)) {
        normalizedToNumber.set(normalized, match.number);
      }
    }
  }

  for (const match of matches) {
    const normalized = normalizeText(match.text);
    let number: number;

    if (match.kind === "manual") {
      number = match.number;
    } else if (normalizedToNumber.has(normalized)) {
      number = normalizedToNumber.get(normalized)!;
    } else if (autoGroupNumbers.has(normalized)) {
      number = autoGroupNumbers.get(normalized)!;
    } else {
      number = smallestUnusedNumber(usedNumbers);
      usedNumbers.add(number);
      autoGroupNumbers.set(normalized, number);
      normalizedToNumber.set(normalized, number);
    }

    const incomingHint = match.hint?.length ? match.hint : undefined;
    if (!groupHints.has(number)) {
      groupHints.set(number, incomingHint);
    } else if (incomingHint !== groupHints.get(number)) {
      warnings.push(`Hint mismatch for cloze c${number}: later hint ignored`);
    }

    assignments.set(match, {
      number,
      hint: groupHints.get(number),
    });
  }

  return { assignments, warnings };
}

function hasEmptyDeletion(matches: ParsedCloze[]): boolean {
  return matches.some((match) => normalizeText(match.text).length === 0);
}

export function processClozeDeletions(
  text: string,
  options: ClozeProcessOptions,
): ClozeProcessResult {
  const matches = findClozeMatches(text, options.allowShorthand);

  if (hasEmptyDeletion(matches)) {
    return {
      text,
      valid: false,
      warnings: [],
    };
  }

  if (matches.length === 0) {
    return {
      text,
      valid: true,
      warnings: [],
    };
  }

  const { assignments, warnings } = assignNumbers(matches);

  let cursor = 0;
  let output = "";

  for (const match of matches) {
    const assignment = assignments.get(match)!;
    output += text.slice(cursor, match.start);
    output += formatCloze(assignment.number, match.text, assignment.hint);
    cursor = match.end;
  }

  output += text.slice(cursor);

  return {
    text: output,
    valid: true,
    warnings,
  };
}
