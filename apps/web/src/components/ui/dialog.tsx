'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40" />
      <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-paper p-6 shadow-xl focus:outline-none">
        <DialogPrimitive.Title className="font-display text-xl font-bold">{title}</DialogPrimitive.Title>
        {description && <DialogPrimitive.Description className="mt-2 text-ink-soft">{description}</DialogPrimitive.Description>}
        <div className="mt-5">{children}</div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 text-ink-soft hover:bg-chalk" aria-label="Close">
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
