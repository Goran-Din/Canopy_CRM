import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { publicApi } from '@/api/publicClient';
import { SigningLayout } from './SigningLayout';
import { QuoteSummary, QuoteData } from './QuoteSummary';
import { SignatureCanvas } from './SignatureCanvas';
import { SigningSuccess } from './SigningSuccess';
import { SigningExpired } from './SigningExpired';
import { SigningAlreadySigned } from './SigningAlreadySigned';
import { SigningInvalid } from './SigningInvalid';

type PageState = 'loading' | 'ready' | 'success' | 'expired' | 'already_signed' | 'invalid';

export default function SigningPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [signerName, setSignerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }

    publicApi.get(`/v1/quotes/sign/${token}`)
      .then((res) => {
        setQuote(res.data);
        setPageState('ready');
      })
      .catch((err) => {
        const status = err.response?.status;
        const message = err.response?.data?.message || '';

        if (status === 401) {
          if (message.toLowerCase().includes('expired')) {
            setPageState('expired');
          } else {
            setPageState('invalid');
          }
        } else if (status === 409) {
          setPageState('already_signed');
        } else {
          setPageState('invalid');
        }
      });
  }, [token]);

  const handleSubmit = async (data: {
    signer_name: string;
    signature_image_base64: string;
    agreement_checked: boolean;
  }) => {
    setIsSubmitting(true);
    try {
      await publicApi.post('/v1/quotes/sign', {
        signing_token: token,
        ...data,
      });
      setSignerName(data.signer_name);
      setPageState('success');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      const status = error.response?.status;
      if (status === 429) {
        toast.error('Too many attempts. Please wait a moment and try again.');
      } else if (status === 409) {
        toast.error('This quote has already been signed.');
        setPageState('already_signed');
      } else {
        const msg = error.response?.data?.message || 'Something went wrong. Please try again.';
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactProps = {
    phone: quote?.company_phone,
    email: quote?.company_email,
  };

  return (
    <SigningLayout>
      {pageState === 'loading' && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {pageState === 'ready' && quote && (
        <>
          <QuoteSummary quote={quote} />
          <SignatureCanvas onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </>
      )}

      {pageState === 'success' && (
        <SigningSuccess
          signerName={signerName}
          propertyAddress={quote?.property_address || ''}
        />
      )}

      {pageState === 'expired' && <SigningExpired {...contactProps} />}
      {pageState === 'already_signed' && <SigningAlreadySigned {...contactProps} />}
      {pageState === 'invalid' && <SigningInvalid {...contactProps} />}
    </SigningLayout>
  );
}
