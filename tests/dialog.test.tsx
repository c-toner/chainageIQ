import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import Dialog from "@/components/dialog";
it("labels the modal and exposes an accessible close action", () => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  const close = vi.fn();
  render(
    <Dialog title="Create an issue" onClose={close}>
      <label>
        Title
        <input />
      </label>
    </Dialog>,
  );
  expect(screen.getByText("Create an issue")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Close dialog", hidden: true }),
  );
  expect(close).toHaveBeenCalledOnce();
});
