import Link from "next/link";

import { Badge } from "@/components/ui/badge";

/** Who an event belongs to: a link to the person, or a tag while unknown. */
export function EventOwner({ personId }: { personId: string | null }) {
  if (!personId) return <Badge variant="outline">Anonymous</Badge>;
  return (
    <Link className="font-medium underline-offset-4 hover:underline" href={`/people/${personId}`}>
      View person
    </Link>
  );
}
