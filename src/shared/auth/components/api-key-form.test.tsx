// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyForm, curlExample, type CreateKeyState } from "./api-key-form";

const WEBHOOK_URL = "https://example.com/webhooks/app";

describe("curlExample", () => {
  it("builds a command that sends the brief's sample event with the key", () => {
    const command = curlExample(WEBHOOK_URL, "cdp_secret");

    expect(command).toContain("curl -X POST https://example.com/webhooks/app");
    expect(command).toContain('-H "Authorization: Bearer cdp_secret"');
    expect(command).toContain('"event_id":"evt_9f3a1c"');
    expect(command).toContain('"user_id":"u_2b6447a3"');
  });
});

describe("ApiKeyForm", () => {
  function renderForm(result: CreateKeyState) {
    const create = vi
      .fn<(previous: CreateKeyState, formData: FormData) => Promise<CreateKeyState>>()
      .mockResolvedValue(result);
    render(<ApiKeyForm create={create} webhookUrl={WEBHOOK_URL} />);
    return { create, user: userEvent.setup() };
  }

  it("sends the typed name and then shows the new key once, with an example", async () => {
    const { create, user } = renderForm({ key: "cdp_secret", name: "Mobile app" });

    await user.type(screen.getByLabelText("Key name"), "Mobile app");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Key for “Mobile app” created.");
    expect(notice).toHaveTextContent("will not be shown again");
    expect(screen.getByText("cdp_secret")).toBeInTheDocument();
    expect(notice).toHaveTextContent("Authorization: Bearer cdp_secret");
    expect((create.mock.calls[0][1] as FormData).get("name")).toBe("Mobile app");
  });

  it("shows the reason when a key could not be created", async () => {
    const { user } = renderForm({ error: "Give the key a name, so you know what uses it." });

    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Give the key a name");
  });
});
