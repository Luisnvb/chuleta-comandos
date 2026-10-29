// Display order and labels for each tool. Ids match data/<id>.yaml.
export const TOOLS = [
  { id: 'linux', label: 'Linux' },
  { id: 'cmd', label: 'CMD' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'git', label: 'Git' },
  { id: 'npm', label: 'npm' },
  { id: 'artisan', label: 'Artisan' },
  { id: 'claude-code', label: 'Claude Code' },
];

const labels = new Map(TOOLS.map((t) => [t.id, t.label]));

export function toolLabel(id) {
  return labels.get(id) ?? id;
}
