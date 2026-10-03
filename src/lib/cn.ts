import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

// Text size tokens from globals.css, so they are not merged away as colours.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "micro", "nano"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
