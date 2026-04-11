import { CheckCircle } from 'lucide-react';

interface SigningAlreadySignedProps {
  phone?: string;
  email?: string;
}

export function SigningAlreadySigned({ phone, email }: SigningAlreadySignedProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 space-y-4">
      <CheckCircle className="h-16 w-16 text-blue-500" />
      <h2 className="text-2xl font-bold">Already Signed</h2>
      <p className="text-muted-foreground">
        This quote has already been accepted. If you have questions about your service, please contact us.
      </p>
      {phone && <p className="text-sm text-muted-foreground">Phone: {phone}</p>}
      {email && <p className="text-sm text-muted-foreground">Email: {email}</p>}
    </div>
  );
}
