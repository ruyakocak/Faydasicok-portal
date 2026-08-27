/**
 * Calculates a structured diff between two objects.
 * Useful for generating precise AuditLog records.
 */
export function getDiff(oldObj: Record<string, any>, newObj: Record<string, any>): { oldData: any, newData: any } | null {
  const oldData: Record<string, any> = {};
  const newData: Record<string, any> = {};
  let hasChanges = false;

  // Check for updated or added fields
  for (const key of Object.keys(newObj)) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Simple comparison, handles primitives and Date objects
    // Skip if both are null/undefined
    if (oldVal == null && newVal == null) continue;

    const oldStr = oldVal instanceof Date ? oldVal.toISOString() : (typeof oldVal === 'object' && oldVal !== null ? JSON.stringify(oldVal) : oldVal);
    const newStr = newVal instanceof Date ? newVal.toISOString() : (typeof newVal === 'object' && newVal !== null ? JSON.stringify(newVal) : newVal);

    if (oldStr !== newStr) {
      oldData[key] = oldVal;
      newData[key] = newVal;
      hasChanges = true;
    }
  }

  // Check for deleted fields
  for (const key of Object.keys(oldObj)) {
    if (!(key in newObj)) {
      oldData[key] = oldObj[key];
      newData[key] = null;
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return null;
  }

  return { oldData, newData };
}
