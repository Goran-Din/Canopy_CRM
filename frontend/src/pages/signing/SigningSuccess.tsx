import { CheckCircle2 } from 'lucide-react';

interface SigningSuccessProps {
  signerName: string;
  propertyAddress: string;
}

export function SigningSuccess({ signerName, propertyAddress }: SigningSuccessProps) {
  return (
    <div className="flex flex-col items-center text-center py-12 space-y-4">
      <CheckCircle2 className="h-20 w-20 text-green-600" />
      <h2 className="text-2xl font-bold">Quote Accepted!</h2>
      <p className="text-lg text-muted-foreground">Thank you, {signerName}.</p>
      <p className="text-muted-foreground">
        Our team will be in touch shortly to schedule your service.
      </p>
      <p className="text-sm text-muted-foreground mt-4">{propertyAddress}</p>
    </div>
  );
}
