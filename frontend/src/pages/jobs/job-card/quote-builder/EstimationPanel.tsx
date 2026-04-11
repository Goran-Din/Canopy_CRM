interface EstimationPanelProps {
  propertyAddress: string | null;
  propertyCategory: string | null;
}

export function EstimationPanel({ propertyAddress, propertyCategory }: EstimationPanelProps) {
  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Estimation Assistant</h4>
      {propertyAddress && <p className="text-sm"><span className="text-muted-foreground">Property:</span> {propertyAddress}</p>}
      {propertyCategory && <p className="text-sm"><span className="text-muted-foreground">Category:</span> {propertyCategory}</p>}
      <p className="text-sm text-muted-foreground mt-4">Price history will appear here when a Xero item is selected.</p>
      <p className="text-xs text-muted-foreground mt-1">(Future feature)</p>
    </div>
  );
}
