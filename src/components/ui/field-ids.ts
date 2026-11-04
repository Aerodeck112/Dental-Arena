/**
 * Deterministic ids for form fields, shared by Field, the controls and ErrorSummary, so an
 * error-summary link `#field-telefon` lands on the right input. Server and client agree.
 */
export function fieldId(name: string): string {
  return `field-${name.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

export function fieldIds(name: string, id?: string) {
  const controlId = id ?? fieldId(name);
  return { controlId, hintId: `${controlId}-indiciu`, errorId: `${controlId}-eroare` };
}

export function errorList(error?: string | string[] | null): string[] {
  if (!error) return [];
  return (Array.isArray(error) ? error : [error]).filter(Boolean);
}
