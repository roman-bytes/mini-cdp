import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { LoadingMessage } from "@/components/loading-message";
import { PageHeader, Section } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listApiKeys } from "@/shared/auth/api-keys";
import { ApiKeyForm } from "@/shared/auth/components/api-key-form";
import { getLiveDb } from "@/shared/db/live";
import { formatDateTime } from "@/shared/format";

import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export const metadata: Metadata = { title: "API keys" };

/** The form, with the webhook's full address taken from the current request. */
async function CreateKey() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return <ApiKeyForm create={createApiKeyAction} webhookUrl={`${protocol}://${host}/webhooks/app`} />;
}

async function ApiKeyList() {
  const keys = await listApiKeys(await getLiveDb());
  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">No keys yet. The webhook refuses every request until one exists.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key starts with</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last used</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id}>
            <TableCell className="font-medium">{key.name}</TableCell>
            <TableCell className="font-mono text-sm">{key.keyPrefix}…</TableCell>
            <TableCell>{formatDateTime(key.createdAt)}</TableCell>
            <TableCell>{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : "Never"}</TableCell>
            <TableCell>
              <Badge variant={key.revokedAt ? "outline" : "secondary"}>{key.revokedAt ? "Revoked" : "Active"}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {key.revokedAt ? null : (
                <form action={revokeApiKeyAction}>
                  <input type="hidden" name="id" value={key.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Revoke
                  </Button>
                </form>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ApiKeysPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="API keys"
        description="The mobile app sends one of these keys with every event. A key can only write events; it cannot read anyone's data."
      />

      <Section title="Create a key">
        <Suspense fallback={<LoadingMessage />}>
          <CreateKey />
        </Suspense>
      </Section>

      <Section title="Keys">
        <Suspense fallback={<LoadingMessage />}>
          <ApiKeyList />
        </Suspense>
      </Section>
    </div>
  );
}
