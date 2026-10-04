import { roundTo } from "@/lib/debit-call-spread";
import { DEFAULT_MONEY_DISPLAY_UNIT } from "@/components/lab/constants";
import type { MoneyDisplayUnit } from "@/components/lab/types";

export function getMoneyDisplayUnitScale(unit: MoneyDisplayUnit): number {
  return unit === "millions" ? 1_000_000 : 1_000;
}

export function getMoneyDisplayUnitSuffix(unit: MoneyDisplayUnit): string {
  return unit === "millions" ? "M" : "K";
}

export function compactNumber(value: number): string {
  return String(roundTo(value, 2)).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

let activeMoneyDisplayUnit: MoneyDisplayUnit = DEFAULT_MONEY_DISPLAY_UNIT;

export function setActiveMoneyDisplayUnit(unit: MoneyDisplayUnit) {
  activeMoneyDisplayUnit = unit;
}

export function formatInputDisplayValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const normalizedValue = Object.is(value, -0) ? 0 : value;

  if (Number.isInteger(normalizedValue)) {
    return String(normalizedValue);
  }

  return String(roundTo(normalizedValue, 4)).replace(/\.?0+$/, "");
}

function formatScaledCurrency(value: number, unit: MoneyDisplayUnit): string {
  const roundedValue = Math.round(value);
  const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;
  const absValue = Math.abs(safeValue);

  if (absValue < 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safeValue);
  }

  const divisor = unit === "millions" ? 1_000_000 : 1_000;
  const suffix = unit === "millions" ? "M" : "K";
  const scaledValue = safeValue / divisor;
  const scaledAbsValue = Math.abs(scaledValue);
  const sign = safeValue < 0 ? "-" : "";
  const maximumFractionDigits =
    scaledAbsValue >= 100 ? 0 : scaledAbsValue >= 10 ? 1 : 2;
  const formattedValue = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(scaledAbsValue);

  return `${sign}$${formattedValue}${suffix}`;
}

export function formatCurrency(value: number): string {
  return formatScaledCurrency(value, activeMoneyDisplayUnit);
}

export function formatCurrencyWithCents(value: number): string {
  const roundedValue = roundTo(value, 2);
  const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;
  const absValue = Math.abs(safeValue);

  if (absValue < 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  }

  const divisor = activeMoneyDisplayUnit === "millions" ? 1_000_000 : 1_000;
  const suffix = activeMoneyDisplayUnit === "millions" ? "M" : "K";
  const scaledValue = absValue / divisor;
  const formattedValue = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(scaledValue);

  return `${safeValue < 0 ? "-" : ""}$${formattedValue}${suffix}`;
}

export function formatStrikeCurrency(value: number): string {
  return `$${formatInputDisplayValue(value)}`;
}

export function formatPriceCurrency(value: number): string {
  return `$${formatInputDisplayValue(value)}`;
}

export function formatCompactCurrency(value: number): string {
  return formatScaledCurrency(value, activeMoneyDisplayUnit);
}

export function formatPercent(value: number): string {
  const roundedValue = Math.round(value * 100);
  const safeValue = Object.is(roundedValue, -0) ? 0 : roundedValue;

  return `${safeValue >= 0 ? "+" : ""}${safeValue}%`;
}

export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Object.is(value, -0) ? 0 : value);
}
