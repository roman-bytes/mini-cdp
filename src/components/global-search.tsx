"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { QuickFindResult } from "@/apps/people/quick-find";

/** Must match QUICK_FIND_MIN_LENGTH on the server. */
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 200;

const KIND_LABELS: Record<string, string> = { subscriber: "Subscriber", app_only: "App only", unknown: "Unknown" };

const ID_LABELS: Record<string, string> = {
  user_id: "App user ID",
  visitor_id: "Web visitor ID",
  device_id: "App device ID",
};

/** The link that shows every match on the People page. */
export function allResultsHref(query: string): string {
  return `/people?q=${encodeURIComponent(query.trim())}`;
}

/** True for Cmd+K on a Mac or Ctrl+K elsewhere. */
export function isSearchShortcut(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}

/**
 * The search box in the top bar, on every page. Matches appear as you type;
 * arrow keys move through them, Enter opens the highlighted person (or every
 * match on the People page), and Cmd/Ctrl+K jumps here from anywhere.
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestRequest = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickFindResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event)) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function search(term: string) {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    setIsSearching(true);
    try {
      const response = await fetch(`/api/people/v1/search?q=${encodeURIComponent(term)}`);
      const body = (await response.json()) as { results: QuickFindResult[] };
      // Only the answer to the newest keystroke is shown.
      if (latestRequest.current === request) setResults(body.results);
    } finally {
      if (latestRequest.current === request) setIsSearching(false);
    }
  }

  function handleChange(value: string) {
    setQuery(value);
    setHighlighted(-1);
    setIsOpen(true);
    clearTimeout(timer.current);
    if (value.trim().length < MIN_LENGTH) {
      latestRequest.current += 1;
      setResults([]);
      setIsSearching(false);
      return;
    }
    timer.current = setTimeout(() => search(value.trim()), DEBOUNCE_MS);
  }

  function go(href: string) {
    setIsOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" && query.trim().length >= MIN_LENGTH) {
      event.preventDefault();
      const person = results[highlighted];
      go(person ? `/people/${person.personId}` : allResultsHref(query));
    } else if (event.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  const showList = isOpen && query.trim().length >= MIN_LENGTH;

  return (
    <div className="relative w-full max-w-lg">
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Find a person"
        aria-expanded={showList}
        aria-controls="global-search-results"
        aria-activedescendant={highlighted >= 0 ? `global-search-${highlighted}` : undefined}
        placeholder="Find a person by email or ID"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="h-8 w-full rounded-lg border border-input bg-transparent pr-12 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1.5 text-[10px] text-muted-foreground">
        ⌘K
      </kbd>

      {showList ? (
        <ul
          id="global-search-results"
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border bg-popover text-sm shadow-md"
        >
          {results.map((person, index) => (
            <li
              key={person.personId}
              id={`global-search-${index}`}
              role="option"
              aria-selected={index === highlighted}
              // Keep focus in the box so the click is not lost to the blur.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(`/people/${person.personId}`)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${index === highlighted ? "bg-secondary" : "hover:bg-secondary"}`}
            >
              <span className="truncate">
                <span className="font-medium">{person.email ?? "No email on file"}</span>
                {person.matched ? (
                  <span className="ml-2 text-muted-foreground">
                    {ID_LABELS[person.matched.type] ?? person.matched.type}: {person.matched.value}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{KIND_LABELS[person.kind] ?? person.kind}</span>
            </li>
          ))}
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-muted-foreground">
              {isSearching ? "Searching…" : "No one matches."}
            </li>
          ) : null}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => go(allResultsHref(query))}
            className="cursor-pointer border-t px-3 py-2 text-muted-foreground hover:bg-secondary"
          >
            See all matches for “{query.trim()}” in People
          </li>
        </ul>
      ) : null}
    </div>
  );
}
