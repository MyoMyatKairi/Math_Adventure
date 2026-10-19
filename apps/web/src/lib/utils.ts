import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en', opts).format(new Date(iso));
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}
