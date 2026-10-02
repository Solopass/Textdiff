import React, { useRef, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFocusTrap } from "./useFocusTrap";

function ModalTest({
  active = true,
  onClose,
}: {
  active?: boolean;
  onClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, {
    active,
    onClose,
  });

  return (
    <div>
      <button data-testid="outside-btn">Outside</button>
      {active && (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          data-testid="modal-container"
          tabIndex={-1}
        >
          <button data-testid="first-btn">First</button>
          <input data-testid="middle-input" placeholder="Middle" />
          <button data-testid="last-btn">Last</button>
        </div>
      )}
    </div>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first focusable element when opened", async () => {
    vi.useFakeTimers();
    render(<ModalTest active={true} />);

    act(() => {
      vi.runAllTimers();
    });

    const firstBtn = screen.getByTestId("first-btn");
    expect(document.activeElement).toBe(firstBtn);
    vi.useRealTimers();
  });

  it("traps Tab key forward from last element back to first", async () => {
    render(<ModalTest active={true} />);

    const firstBtn = screen.getByTestId("first-btn");
    const lastBtn = screen.getByTestId("last-btn");

    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(firstBtn);
  });

  it("traps Shift+Tab key backward from first element to last", async () => {
    render(<ModalTest active={true} />);

    const firstBtn = screen.getByTestId("first-btn");
    const lastBtn = screen.getByTestId("last-btn");

    firstBtn.focus();
    expect(document.activeElement).toBe(firstBtn);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);
  });

  it("calls onClose when Escape is pressed", async () => {
    const handleClose = vi.fn();
    render(<ModalTest active={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to previous element when closed", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ModalTest active={false} />);

    const outsideBtn = screen.getByTestId("outside-btn");
    outsideBtn.focus();
    expect(document.activeElement).toBe(outsideBtn);

    // Open modal
    rerender(<ModalTest active={true} />);
    act(() => {
      vi.runAllTimers();
    });
    expect(document.activeElement).toBe(screen.getByTestId("first-btn"));

    // Close modal
    rerender(<ModalTest active={false} />);
    expect(document.activeElement).toBe(outsideBtn);
    vi.useRealTimers();
  });
});
