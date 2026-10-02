import React, { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface UseFocusTrapOptions {
  active: boolean;
  onClose?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Traps keyboard focus within an overlay container (modal, dialog, drawer)
 * while active, and restores focus to the previously focused element upon deactivation.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  containerRef: React.RefObject<T | null>,
  { active, onClose, initialFocusRef }: UseFocusTrapOptions
) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Record the element that had focus before opening the dialog
    if (typeof document !== "undefined") {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }

    const container = containerRef.current;
    if (!container) return;

    // Focus the initial element or the first focusable element inside the modal
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const focusables = (
          Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[]
        ).filter((el) => el.offsetParent !== null || el.tabIndex >= 0);

        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          container.focus();
        }
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;

      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusables = (
          Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[]
        ).filter((el) => el.offsetParent !== null || el.tabIndex >= 0);

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === containerRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);

      // Restore focus
      if (
        previousActiveElement.current &&
        typeof previousActiveElement.current.focus === "function" &&
        document.body.contains(previousActiveElement.current)
      ) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, containerRef, onClose, initialFocusRef]);
}
