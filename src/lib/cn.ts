import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

// Tokens from globals.css, so sizes are not merged away as colours and
// token spacing and radius classes override the defaults they replace.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "micro", "nano"],
      spacing: ["control", "panel", "panel-lg", "section"],
      radius: ["control", "panel"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
