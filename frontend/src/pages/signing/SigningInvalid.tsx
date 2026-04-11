import { AlertTriangle } from 'lucide-react';

interface SigningInvalidProps {
  phone?: string;
  email?: string;
}

export function SigningInvalid({ phone, email }: SigningInvalidProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 space-y-4">
      <AlertTriangle className="h-16 w-16 text-red-500" />
      <h2 className="text-2xl font-bold">Link Not Found</h2>
      <p className="text-muted-foreground">
        This signing link is not valid. If you received this link in an email or text from Sunset Services, please contact us.
      </p>
      {phone && <p className="text-sm text-muted-foreground">Phone: {phone}</p>}
      {email && <p className="text-sm text-muted-foreground">Email: {email}</p>}
    </div>
  );
}
