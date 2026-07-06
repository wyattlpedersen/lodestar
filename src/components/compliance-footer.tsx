export function ComplianceFooter({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-[11px] leading-snug text-muted-foreground ${className}`}
    >
      Prospect research tool using public IRS Form 990 data and analyst-entered
      notes. Not investment advice. Internal use only — verify all data before
      client contact.
    </p>
  );
}
