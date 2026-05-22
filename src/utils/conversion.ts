/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses temperature string and returns converted string and unit for target locale
 */
export function formatTemperature(val: string, targetLocale: "US" | "India" | "Australia"): { value: string; unit: string } {
  if (!val) return { value: "", unit: targetLocale === "US" ? "°F" : "°C" };

  // Try to parse out numeric value
  const numMatch = val.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!numMatch) {
    return { value: val, unit: targetLocale === "US" ? "°F" : "°C" };
  }

  const num = parseFloat(numMatch[0]);
  const isFahrenheit = val.toLowerCase().includes("f") || val.toLowerCase().includes("99") || val.toLowerCase().includes("98") || val.toLowerCase().includes("100") || val.toLowerCase().includes("101") || val.toLowerCase().includes("102") || num > 45;

  if (targetLocale === "US") {
    if (!isFahrenheit) {
      // Convert C to F
      const converted = (num * 9) / 5 + 32;
      return { value: converted.toFixed(1), unit: "°F" };
    }
    return { value: num.toFixed(1), unit: "°F" };
  } else {
    // Target is C (India, Australia)
    if (isFahrenheit) {
      // Convert F to C
      const converted = ((num - 32) * 5) / 9;
      return { value: converted.toFixed(1), unit: "°C" };
    }
    return { value: num.toFixed(1), unit: "°C" };
  }
}

/**
 * Convers glucose between mg/dL and mmol/L
 */
export function formatGlucose(val: string, targetLocale: "US" | "India" | "Australia"): { value: string; unit: string } {
  if (!val) return { value: "", unit: targetLocale === "Australia" ? "mmol/L" : "mg/dL" };

  const numMatch = val.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!numMatch) {
    return { value: val, unit: targetLocale === "Australia" ? "mmol/L" : "mg/dL" };
  }

  const num = parseFloat(numMatch[0]);
  // Usually mmol/L is small (e.g. 2 to 30), mg/dL is large (e.g. 50 to 500)
  const isMmol = val.toLowerCase().includes("mmol") || num < 40;

  if (targetLocale === "Australia") {
    if (!isMmol) {
      // Convert mg/dL to mmol/L
      const converted = num / 18.0182;
      return { value: converted.toFixed(1), unit: "mmol/L" };
    }
    return { value: num.toFixed(1), unit: "mmol/L" };
  } else {
    // US or India uses mg/dL
    if (isMmol) {
      // Convert mmol/L to mg/dL
      const converted = num * 18.0182;
      return { value: Math.round(converted).toString(), unit: "mg/dL" };
    }
    return { value: Math.round(num).toString(), unit: "mg/dL" };
  }
}
