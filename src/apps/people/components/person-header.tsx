import Link from "next/link";

import { CopyButton } from "@/components/copy-button";

import type { Profile } from "../directory";
import { KindBadge, personName } from "./person-labels";

/**
 * The top of a profile: who it is, what kind of person, and their person ID,
 * the one ID every other ID (email, visitor, app user, device) points at.
 */
export function PersonHeader({ profile }: { profile: Pick<Profile, "personId" | "email" | "kind"> }) {
  return (
    <header className="space-y-2">
      <Link href="/people" className="text-sm text-muted-foreground hover:text-foreground">
        ← People
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{personName(profile)}</h1>
        <KindBadge kind={profile.kind} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Person ID</span>
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground select-all">
          {profile.personId}
        </code>
        <CopyButton value={profile.personId} what="person ID" />
      </div>
    </header>
  );
}
