import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Sınıf birleştirici. twMerge çakışan Tailwind sınıflarını çözer: bileşenin
 * varsayılan `px-5`'i ile çağıranın verdiği `px-3` yan yana gelirse
 * sonuncusu kazanır — `!px-3` gibi önem işaretlerine gerek kalmaz.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
