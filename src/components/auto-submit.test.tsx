// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AutoSubmit } from "./auto-submit";

function renderForm() {
  const { container } = render(
    <form action="/people">
      <AutoSubmit />
      <input name="q" defaultValue="" />
      <select name="type" defaultValue="">
        <option value="">any</option>
        <option value="subscriber">Subscriber</option>
      </select>
    </form>,
  );
  const form = container.querySelector("form")!;
  return { form, input: container.querySelector("input[name=q]")!, select: container.querySelector("select")! };
}

describe("AutoSubmit", () => {
  it("submits the form when a select changes", () => {
    const { form, select } = renderForm();
    const requestSubmit = vi.spyOn(form, "requestSubmit").mockImplementation(() => {});

    fireEvent.change(select, { target: { value: "subscriber" } });

    expect(requestSubmit).toHaveBeenCalled();
  });

  it("does not submit when a text box changes", () => {
    const { form, input } = renderForm();
    const requestSubmit = vi.spyOn(form, "requestSubmit").mockImplementation(() => {});

    fireEvent.change(input, { target: { value: "julia" } });

    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it("leaves empty fields out of the submitted address", () => {
    const { form, input, select } = renderForm();
    fireEvent.change(select, { target: { value: "subscriber" } });

    form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(input).toBeDisabled();
    expect(select).not.toBeDisabled();
  });
});
