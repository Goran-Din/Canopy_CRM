import { Clock } from 'lucide-react';

interface SigningExpiredProps {
  phone?: string;
  email?: string;
}

export function SigningExpired({ phone, email }: SigningExpiredProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 space-y-4">
      <Clock className="h-16 w-16 text-amber-500" />
      <h2 className="text-2xl font-bold">This Quote Has Expired</h2>
      <p className="text-muted-foreground">
        The quote you're looking for is no longer available. Please contact us for an updated quote.
      </p>
      {phone && <p className="text-sm text-muted-foreground">Phone: {phone}</p>}
      {email && <p className="text-sm text-muted-foreground">Email: {email}</p>}
    </div>
  );
}
