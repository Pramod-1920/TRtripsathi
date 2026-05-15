'use client';

import { FiAlertTriangle, FiX } from 'react-icons/fi';

type ConfirmModalProps = {
  open?: boolean;
  isOpen?: boolean;
  title: string;
  description?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: 'danger' | 'default' | string;
  isProcessing?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonValue?: string;
  onReasonChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  isOpen,
  title,
  description,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  intent = 'danger',
  isProcessing = false,
  requireReason = false,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Enter a reason',
  reasonValue = '',
  onReasonChange,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const isVisible = open ?? isOpen ?? false;
  const bodyText = description ?? message ?? '';
  const confirmClass = intent === 'danger'
    ? 'rounded-full bg-destructive px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60'
    : 'rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary-container disabled:opacity-60';

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/15 p-2 text-primary">
              <FiAlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{bodyText}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <FiX size={16} />
          </button>
        </div>

        {requireReason && (
          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-foreground">{reasonLabel}</label>
            <textarea
              value={reasonValue}
              onChange={(event) => onReasonChange?.(event.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={confirmClass}
          >
            {isProcessing ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
