import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// "Sarah Adjei" -> "SA"; falls back to "?" while the user isn't loaded.
export function getInitials(name?: string) {
  const letters = (name ?? "")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return letters || "?"
}
