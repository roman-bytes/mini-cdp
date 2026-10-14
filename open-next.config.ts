import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every data page reads the database on each request, so no shared cache is set up.
export default defineCloudflareConfig();
