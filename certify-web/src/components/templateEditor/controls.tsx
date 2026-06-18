"use client";

import type { ReactNode } from "react";
import { IconBadge } from "../icons";

// Small presentational primitives for the template editor's side panels.
// Pure UI — no canvas/state knowledge — extracted from TemplateEditor.tsx.

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-extrabold text-ink">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function ToolBtn({ icon: Icon, label, onClick }: { icon: typeof IconBadge; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-ghost w-full justify-start">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

export function NumberRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-ink-muted">{label}</span>
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm" />
    </div>
  );
}

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-ink-muted">{label}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 cursor-pointer rounded border border-line bg-white" />
    </div>
  );
}
