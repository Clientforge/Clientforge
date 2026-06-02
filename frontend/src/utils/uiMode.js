export function isSimpleMode(tenant) {
  return (tenant?.uiMode || 'simple') !== 'full';
}

export function homePath(tenant) {
  return isSimpleMode(tenant) ? '/conversations' : '/dashboard';
}
