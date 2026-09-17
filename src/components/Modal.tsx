import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

/** Native modal semantics make the background inert; Tab wraps inside the dialog. */
export function Modal({ children, label, onClose }: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const candidates = Array.from(ref.current!.querySelectorAll(focusableSelector)) as HTMLElement[];
    const elements = candidates.filter(element => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) {
      event.preventDefault();
      ref.current?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      onKeyDown={handleKeyDown}
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="parite-shell fixed inset-0 m-auto max-h-[95dvh] max-w-[calc(100%-2rem)] overflow-visible border-0 bg-transparent p-0 text-[var(--color-text)] backdrop:bg-slate-950/70 backdrop:backdrop-blur-sm"
    >
      {children}
    </dialog>,
    document.body,
  );
}
