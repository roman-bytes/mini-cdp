/** The layers that keep personal data away from the AI, in the order a question meets them. */
export const PRIVACY_LAYERS = [
  {
    title: "The question is scrubbed",
    detail:
      "Any email or app, web or device ID you type is swapped for a random person key before the question leaves this app.",
  },
  {
    title: "The AI only sees PII-free views",
    detail:
      "Its SQL runs as a database role that can read the views in the ai schema and nothing else. Those views have no emails and no raw IDs; a person is a random key. A query for an email fails with permission denied.",
  },
  {
    title: "Its SQL can only read",
    detail: "One statement, wrapped in a SELECT, inside a read-only transaction, with a 5 second limit.",
  },
  {
    title: "Every request is checked before it is sent",
    detail:
      "The whole request is scanned for anything that looks like an email or a raw ID. If something is found, the request is stopped and never sent.",
  },
  {
    title: "People are added back afterwards",
    detail:
      "When an answer lists people, the AI returns their keys. This app swaps the keys for emails when showing you the table, after the AI has finished.",
  },
  {
    title: "Everything is on the record",
    detail: "Each answer shows exactly what was sent to the AI and what came back.",
  },
];

export function PrivacyExplainer() {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {PRIVACY_LAYERS.map((layer, index) => (
        <li key={layer.title} className="rounded-xl border p-4">
          <p className="font-medium">
            {index + 1}. {layer.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{layer.detail}</p>
        </li>
      ))}
    </ol>
  );
}
