"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Drives a native <dialog> from an `open` prop: showModal()/show() on open, close() on close,
 * and reports Esc, the close button and backdrop clicks through `onClose`.
 */
export function useNativeDialog(open: boolean, onClose: () => void, modal = true): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);
  const closingByProp = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (modal) dialog.showModal();
      else dialog.show();
    } else if (!open && dialog.open) {
      closingByProp.current = true;
      dialog.close();
    }
  }, [open, modal]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      // Closed by the parent (open → false): nothing to report.
      if (closingByProp.current) {
        closingByProp.current = false;
        return;
      }
      onCloseRef.current();
    };
    const handleCancel = (e: Event) => {
      // Esc: let the parent decide by closing through state.
      e.preventDefault();
      onCloseRef.current();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (!modal && e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    const handleClick = (e: MouseEvent) => {
      // A click on the <dialog> element itself is a click on the backdrop (content sits in a child).
      if (modal && e.target === dialog) onCloseRef.current();
    };
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("keydown", handleKey);
    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("keydown", handleKey);
      dialog.removeEventListener("click", handleClick);
    };
  }, [modal]);

  return ref;
}
