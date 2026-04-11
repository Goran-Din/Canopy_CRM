import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiClient } from '@/api/client';
import { useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface SendQuoteDialogProps {
  quoteId: string;
  customerEmail: string | null;
  customerPhone: string | null;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export function SendQuoteDialog({ quoteId, customerEmail, customerPhone, open, onClose, onSent }: SendQuoteDialogProps) {
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [email, setEmail] = useState(customerEmail || '');
  const [phone, setPhone] = useState(customerPhone || '');
  const [message, setMessage] = useState('');
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfTimeout, setPdfTimeout] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const startRef = useRef<number>(0);

  const sendQuote = useApiMutation<void, { channel: string; email: string; phone: string; message: string }>(
    'post', `/v1/quotes/${quoteId}/send`, [['quote', quoteId]],
  );

  useEffect(() => {
    if (!open) return;
    setPdfReady(false);
    setPdfTimeout(false);
    startRef.current = Date.now();
    apiClient.post(`/v1/quotes/${quoteId}/generate-pdf`).catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const { data } = await apiClient.get(`/v1/quotes/${quoteId}`);
        if (data.pdf_file_id) {
          setPdfReady(true);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
      if (Date.now() - startRef.current > 30000) {
        setPdfTimeout(true);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, quoteId]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await sendQuote.mutateAsync({ channel, email, phone, message });
      toast.success('Quote sent!');
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send quote.';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Send Quote to Client</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Send via</Label>
            <div className="flex gap-4">
              {(['email', 'sms', 'both'] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="channel" value={ch} checked={channel === ch} onChange={() => setChannel(ch)} className="accent-primary" />
                  {ch === 'email' ? 'Email' : ch === 'sms' ? 'SMS' : 'Both'}
                </label>
              ))}
            </div>
          </div>
          {(channel === 'email' || channel === 'both') && (
            <div className="space-y-1"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></div>
          )}
          {(channel === 'sms' || channel === 'both') && (
            <div className="space-y-1"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" /></div>
          )}
          <div className="space-y-1">
            <Label>Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional cover message..." className="min-h-[60px]" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">PDF:</span>
            {pdfReady ? (
              <span className="flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> Ready</span>
            ) : pdfTimeout ? (
              <span className="text-amber-600">PDF generation is taking longer than expected. Please try again.</span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Generating...</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!pdfReady || isSending}>{isSending ? 'Sending...' : 'Send Quote'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
