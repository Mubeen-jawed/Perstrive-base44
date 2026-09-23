"use client";

import { Trash2 } from "lucide-react";

/** Submit button for a delete form that asks before submitting. */
export default function ConfirmButton({ message, label = "Delete" }: { message: string; label?: string }) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="text-muted-foreground hover:text-primary"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
