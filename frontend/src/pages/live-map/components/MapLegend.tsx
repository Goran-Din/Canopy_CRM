export function MapLegend() {
  const items = [
    { color: '#2ecc71', label: 'On Site', pulse: true },
    { color: '#3498db', label: 'In Transit', pulse: false },
    { color: '#95a5a6', label: 'Not Clocked In', pulse: false },
    { color: '#f39c12', label: 'No Signal', pulse: false },
  ];

  return (
    <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 border rounded-lg shadow-md p-2">
      <p className="text-xs font-medium text-muted-foreground mb-1">Legend</p>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div style={{ background: item.color, width: 12, height: 12, borderRadius: '50%' }} />
            <span className="text-xs">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
