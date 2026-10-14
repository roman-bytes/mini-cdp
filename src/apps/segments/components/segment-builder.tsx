"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { SegmentDefinition, SegmentField, SegmentRule } from "../definition";
import type { SaveResult, SegmentPreview } from "../preview";
import { newRule, withOperator, withValue } from "../rule-editing";
import { MembersTable, SegmentSizeLine } from "./members-table";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type RuleRowProps = {
  rule: SegmentRule;
  fields: SegmentField[];
  position: number;
  onChange: (rule: SegmentRule) => void;
  onRemove: () => void;
};

/** One rule: a field, an operator and, when the operator needs one, a value. */
function RuleRow({ rule, fields, position, onChange, onRemove }: RuleRowProps) {
  const field = fields.find((candidate) => candidate.field === rule.field) ?? fields[0];
  const operator = field.operators.find((candidate) => candidate.op === rule.op) ?? field.operators[0];
  const label = `Rule ${position}`;

  return (
    <li className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`${label} field`}
        className={selectClass}
        value={field.field}
        onChange={(event) => onChange(newRule(fields.find((candidate) => candidate.field === event.target.value)!))}
      >
        {fields.map((candidate) => (
          <option key={candidate.field} value={candidate.field}>
            {candidate.label}
          </option>
        ))}
      </select>

      <select
        aria-label={`${label} operator`}
        className={selectClass}
        value={operator.op}
        onChange={(event) => onChange(withOperator(rule, field, event.target.value))}
      >
        {field.operators.map((candidate) => (
          <option key={candidate.op} value={candidate.op}>
            {candidate.label}
          </option>
        ))}
      </select>

      {operator.value === "choice" ? (
        <select
          aria-label={`${label} value`}
          className={selectClass}
          value={String(rule.value ?? "")}
          onChange={(event) => onChange(withValue(rule, field, event.target.value))}
        >
          {field.choices?.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      ) : null}

      {operator.value === "number" || operator.value === "date" || operator.value === "text" ? (
        <Input
          aria-label={`${label} value`}
          className="w-44"
          type={operator.value}
          min={operator.value === "number" ? 0 : undefined}
          placeholder={operator.value === "text" ? "/subscribe" : undefined}
          value={String(rule.value ?? "")}
          onChange={(event) => onChange(withValue(rule, field, event.target.value))}
        />
      ) : null}

      <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove rule ${position}`}>
        Remove
      </Button>
    </li>
  );
}

type SegmentBuilderProps = {
  /** The catalog of fields a rule can use. */
  fields: SegmentField[];
  initial: SegmentDefinition;
  /** Runs the rules on the server and returns the count and a sample. */
  preview: (definition: SegmentDefinition) => Promise<SegmentPreview>;
  /** Saves the segment. On success the server sends the browser to it. */
  save: (name: string, definition: SegmentDefinition) => Promise<SaveResult>;
};

/**
 * Builds a segment from rules. The count and the list refresh from the server
 * whenever a rule changes, so what is shown is always what would be saved.
 */
export function SegmentBuilder({ fields, initial, preview, save }: SegmentBuilderProps) {
  const [definition, setDefinition] = useState(initial);
  const [result, setResult] = useState<SegmentPreview | null>(null);
  const [name, setName] = useState("");
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const latestRequest = useRef(0);

  useEffect(() => {
    // Rules can change while an earlier preview is still on its way back.
    // Only the answer to the newest request is shown.
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    startTransition(async () => {
      const answer = await preview(definition);
      if (latestRequest.current === request) setResult(answer);
    });
  }, [definition, preview]);

  function replaceRule(index: number, rule: SegmentRule) {
    setDefinition({ ...definition, rules: definition.rules.map((current, i) => (i === index ? rule : current)) });
  }

  function removeRule(index: number) {
    setDefinition({ ...definition, rules: definition.rules.filter((_, i) => i !== index) });
  }

  function addRule() {
    setDefinition({ ...definition, rules: [...definition.rules, newRule(fields[0])] });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const outcome = await save(name, definition);
    setSaveErrors(outcome.ok ? [] : outcome.errors);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border p-4">
        <label className="flex items-center gap-2 text-sm">
          People who match
          <select
            aria-label="Match mode"
            className={selectClass}
            value={definition.match}
            onChange={(event) => setDefinition({ ...definition, match: event.target.value as "all" | "any" })}
          >
            <option value="all">all of these rules</option>
            <option value="any">any of these rules</option>
          </select>
        </label>

        <ul className="space-y-2">
          {definition.rules.map((rule, index) => (
            <RuleRow
              key={index}
              rule={rule}
              fields={fields}
              position={index + 1}
              onChange={(changed) => replaceRule(index, changed)}
              onRemove={() => removeRule(index)}
            />
          ))}
        </ul>
        {definition.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules, so this matches everyone.</p>
        ) : null}

        <Button type="button" variant="outline" size="sm" onClick={addRule}>
          Add rule
        </Button>
      </div>

      <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Segment name"
          className="w-72"
          placeholder="Name this segment"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit">Save segment</Button>
        {saveErrors.map((error) => (
          <p key={error} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ))}
      </form>

      <div className="space-y-3" aria-live="polite" aria-busy={isPending}>
        {result === null ? <p className="text-sm text-muted-foreground">Counting…</p> : null}
        {result?.ok === false
          ? result.errors.map((error) => (
              <p key={error} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ))
          : null}
        {result?.ok ? (
          <>
            <SegmentSizeLine total={result.size.total} neverOpened={result.size.neverOpened} />
            <MembersTable members={result.members} />
            {result.size.total > result.members.length ? (
              <p className="text-sm text-muted-foreground">
                Showing the first {result.members.length}. Save the segment to see everyone and export it.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
