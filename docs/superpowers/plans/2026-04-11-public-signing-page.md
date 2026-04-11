# Public Quote Signing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone public page at `/sign/:token` where clients view and sign quotes without authentication.

**Architecture:** State-machine component fetches quote data via a token-only (no JWT) axios instance. Canvas captures signature as base64 PNG, submitted via POST. Five terminal states (loading, ready, success, expired, already_signed, invalid) render distinct UI screens.

**Tech Stack:** React 18, Vite 5, TypeScript, shadcn/ui (Card, Button, Input, Checkbox, Label), Lucide icons, HTML5 Canvas, Axios (standalone instance), Vitest + React Testing Library.

**Frontend root:** `C:\Users\Goran\Documents\03-DEVELOPMENT\Canopy CRM\Code\canopy_crm\frontend`

---

## File Structure

```
frontend/src/pages/signing/
├── SigningPage.tsx            # Main state-machine component (fetches data, routes to sub-screens)
├── SigningLayout.tsx          # Minimal layout wrapper (no sidebar, centered, branded)
├── QuoteSummary.tsx           # Displays quote sections, line items, totals
├── SignatureCanvas.tsx        # Canvas drawing pad + name/checkbox/submit form
├── SigningSuccess.tsx         # Terminal: accepted confirmation
├── SigningExpired.tsx         # Terminal: quote expired
├── SigningAlreadySigned.tsx   # Terminal: already signed
├── SigningInvalid.tsx         # Terminal: bad token
└── __tests__/
    └── SigningPage.test.tsx   # Full test suite (14 cases)

frontend/src/api/
└── publicClient.ts           # Axios instance WITHOUT auth interceptors

frontend/src/App.tsx          # Add /sign/:token route (modify)
```

---

## Task 0: Install Test Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install testing libraries**

```bash
cd frontend && npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create vitest config for frontend**

Create `frontend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 3: Create test setup file**

Create `frontend/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Verify test infrastructure works**

Run: `cd frontend && npx vitest run --passWithNoTests`
Expected: PASS (no tests yet but setup verified)

- [ ] **Step 5: Commit**

```bash
git add frontend/vitest.config.ts frontend/src/test/setup.ts frontend/package.json frontend/package-lock.json
git commit -m "chore: add vitest + testing-library setup for frontend"
```

---

## Task 1: Public API Client

**Files:**
- Create: `frontend/src/api/publicClient.ts`

- [ ] **Step 1: Create the public axios instance**

Create `frontend/src/api/publicClient.ts`:

```typescript
import axios from 'axios';

/**
 * Axios instance for public (unauthenticated) endpoints.
 * Does NOT attach JWT or trigger token refresh.
 */
export const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/publicClient.ts
git commit -m "feat(signing): add public axios client without auth interceptors"
```

---

## Task 2: Signing Layout

**Files:**
- Create: `frontend/src/pages/signing/SigningLayout.tsx`

- [ ] **Step 1: Create the layout component**

Create `frontend/src/pages/signing/SigningLayout.tsx`:

```typescript
import { Toaster } from '@/components/ui/sonner';

interface SigningLayoutProps {
  children: React.ReactNode;
}

export function SigningLayout({ children }: SigningLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="pt-8 pb-4 text-center">
        <h1 className="text-2xl font-bold text-[#2E7D32]">Sunset Services</h1>
        <p className="text-sm text-muted-foreground">Landscaping &amp; Property Maintenance</p>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-[720px] mx-auto px-4 pb-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-gray-400">Powered by Canopy CRM</p>
      </footer>

      <Toaster position="top-center" richColors />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/signing/SigningLayout.tsx
git commit -m "feat(signing): add SigningLayout with branded header and footer"
```

---

## Task 3: Terminal State Screens

**Files:**
- Create: `frontend/src/pages/signing/SigningSuccess.tsx`
- Create: `frontend/src/pages/signing/SigningExpired.tsx`
- Create: `frontend/src/pages/signing/SigningAlreadySigned.tsx`
- Create: `frontend/src/pages/signing/SigningInvalid.tsx`

- [ ] **Step 1: Create SigningSuccess**

Create `frontend/src/pages/signing/SigningSuccess.tsx`:

```typescript
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
```

- [ ] **Step 2: Create SigningExpired**

Create `frontend/src/pages/signing/SigningExpired.tsx`:

```typescript
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
```

- [ ] **Step 3: Create SigningAlreadySigned**

Create `frontend/src/pages/signing/SigningAlreadySigned.tsx`:

```typescript
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
```

- [ ] **Step 4: Create SigningInvalid**

Create `frontend/src/pages/signing/SigningInvalid.tsx`:

```typescript
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
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/signing/SigningSuccess.tsx frontend/src/pages/signing/SigningExpired.tsx frontend/src/pages/signing/SigningAlreadySigned.tsx frontend/src/pages/signing/SigningInvalid.tsx
git commit -m "feat(signing): add terminal state screens (success, expired, already-signed, invalid)"
```

---

## Task 4: QuoteSummary Component

**Files:**
- Create: `frontend/src/pages/signing/QuoteSummary.tsx`

- [ ] **Step 1: Create the QuoteSummary component**

Create `frontend/src/pages/signing/QuoteSummary.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

interface Section {
  id: string;
  title: string;
  body?: string;
  sort_order: number;
  line_items: LineItem[];
}

export interface QuoteData {
  quote_number: string;
  valid_until: string;
  customer_name: string;
  property_address: string;
  sections: Section[];
  subtotal: number;
  discount_amount: number;
  total: number;
  client_notes?: string;
  payment_terms?: string;
  company_phone?: string;
  company_email?: string;
}

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '$0.00';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

interface QuoteSummaryProps {
  quote: QuoteData;
}

export function QuoteSummary({ quote }: QuoteSummaryProps) {
  const sortedSections = [...quote.sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">Quote {quote.quote_number}</CardTitle>
        <p className="text-sm text-muted-foreground">Valid until: {quote.valid_until}</p>
        <div className="pt-2 space-y-1">
          <p className="text-sm"><span className="text-muted-foreground">Prepared for:</span> {quote.customer_name}</p>
          <p className="text-sm"><span className="text-muted-foreground">Property:</span> {quote.property_address}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Sections with line items */}
        {sortedSections.map((section) => {
          const sortedItems = [...section.line_items].sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={section.id} className="space-y-2">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h3>
              {section.body && (
                <p className="text-sm text-muted-foreground">{section.body}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Item</th>
                      <th className="text-right py-2 font-medium">Qty</th>
                      <th className="text-right py-2 font-medium">Price</th>
                      <th className="text-right py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{fmt(item.unit_price)}</td>
                        <td className="text-right py-2 font-medium">{fmt(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div className="border-t pt-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{fmt(quote.subtotal)}</span>
          </div>
          {quote.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-green-600">-{fmt(quote.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-1">
            <span>Total</span>
            <span>{fmt(quote.total)}</span>
          </div>
        </div>

        {/* Notes & terms */}
        {quote.client_notes && (
          <div className="pt-2">
            <p className="text-sm text-muted-foreground">{quote.client_notes}</p>
          </div>
        )}
        {quote.payment_terms && (
          <div className="pt-1">
            <p className="text-sm text-muted-foreground">{quote.payment_terms}</p>
          </div>
        )}

        {/* Contact info */}
        {(quote.company_phone || quote.company_email) && (
          <div className="border-t pt-4 text-sm text-muted-foreground text-center space-y-1">
            {quote.company_phone && <p>Questions? Call {quote.company_phone}</p>}
            {quote.company_email && <p>or email {quote.company_email}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/signing/QuoteSummary.tsx
git commit -m "feat(signing): add QuoteSummary component with sections, line items, and totals"
```

---

## Task 5: SignatureCanvas Component

**Files:**
- Create: `frontend/src/pages/signing/SignatureCanvas.tsx`

- [ ] **Step 1: Create the SignatureCanvas component**

Create `frontend/src/pages/signing/SignatureCanvas.tsx`:

```typescript
import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface SignatureCanvasProps {
  onSubmit: (data: {
    signer_name: string;
    signature_image_base64: string;
    agreement_checked: boolean;
  }) => void;
  isSubmitting: boolean;
}

export function SignatureCanvas({ onSubmit, isSubmitting }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);

  const isReady = signerName.trim().length >= 2 && agreed && hasDrawn;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution to match display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
  }, []);

  const getPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  }, [getPosition]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }, [isDrawing, getPosition]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];

    onSubmit({
      signer_name: signerName.trim(),
      signature_image_base64: base64,
      agreement_checked: true,
    });
  };

  return (
    <div className="space-y-4 mt-6">
      {/* Signature canvas */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Signature</Label>
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-[200px] border border-dashed border-gray-300 rounded-md cursor-crosshair"
            style={{ touchAction: 'none' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {!hasDrawn && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-gray-400 text-sm">Sign here</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={clearCanvas} type="button">
          Clear
        </Button>
      </div>

      {/* Name input */}
      <div className="space-y-2">
        <Label htmlFor="signer-name" className="text-sm font-medium">Your Name</Label>
        <Input
          id="signer-name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Enter your full name"
          className="text-base"
        />
      </div>

      {/* Agreement checkbox */}
      <div className="flex items-start space-x-3">
        <Checkbox
          id="agreement"
          checked={agreed}
          onCheckedChange={(checked) => setAgreed(checked === true)}
        />
        <Label htmlFor="agreement" className="text-sm leading-relaxed cursor-pointer">
          I have reviewed and accept this quote and authorize Sunset Services to proceed with the described work.
        </Label>
      </div>

      {/* Submit button */}
      <Button
        className="w-full h-12 text-base font-semibold bg-[#2E7D32] hover:bg-[#256429]"
        disabled={!isReady || isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          'Accept & Sign Quote'
        )}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/signing/SignatureCanvas.tsx
git commit -m "feat(signing): add SignatureCanvas with drawing pad, name input, and agreement form"
```

---

## Task 6: Main SigningPage Component

**Files:**
- Create: `frontend/src/pages/signing/SigningPage.tsx`

- [ ] **Step 1: Create the main SigningPage state machine**

Create `frontend/src/pages/signing/SigningPage.tsx`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/signing/SigningPage.tsx
git commit -m "feat(signing): add main SigningPage state machine component"
```

---

## Task 7: Add Route to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add the import and route**

At the top of `frontend/src/App.tsx`, add after the last crew-mobile import (line 65):

```typescript
import SigningPage from './pages/signing/SigningPage';
```

Then add the public signing route BEFORE the protected routes block. After line 71 (`<Route path="/login" element={<LoginPage />} />`), add:

```typescript
        {/* Public signing page — no auth required */}
        <Route path="/sign/:token" element={<SigningPage />} />
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(signing): add /sign/:token public route"
```

---

## Task 8: Test Suite

**Files:**
- Create: `frontend/src/pages/signing/__tests__/SigningPage.test.tsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/pages/signing/__tests__/SigningPage.test.tsx`:

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SigningPage from '../SigningPage';

// Mock the publicApi module
vi.mock('@/api/publicClient', () => ({
  publicApi: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
  Toaster: () => null,
}));

import { publicApi } from '@/api/publicClient';
import { toast } from 'sonner';

const mockQuote = {
  quote_number: 'Q-2026-001',
  valid_until: '2026-05-01',
  customer_name: 'John Smith',
  property_address: '123 Main St, Austin TX',
  sections: [
    {
      id: 's1',
      title: 'Weekly Maintenance',
      body: 'Regular lawn care',
      sort_order: 1,
      line_items: [
        { id: 'li1', description: 'Mowing', quantity: 4, unit_price: 35, line_total: 140, sort_order: 1 },
        { id: 'li2', description: 'Edging', quantity: 4, unit_price: 15, line_total: 60, sort_order: 2 },
      ],
    },
    {
      id: 's2',
      title: 'Monthly Services',
      body: null,
      sort_order: 2,
      line_items: [
        { id: 'li3', description: 'Fertilization', quantity: 1, unit_price: 85, line_total: 85, sort_order: 1 },
      ],
    },
  ],
  subtotal: 285,
  discount_amount: 10,
  total: 275,
  client_notes: 'Work starts Monday.',
  payment_terms: 'Net 30',
  company_phone: '(512) 555-0100',
  company_email: 'info@sunsetservices.com',
};

function renderPage(token = 'valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/sign/${token}`]}>
      <Routes>
        <Route path="/sign/:token" element={<SigningPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SigningPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByRole('img', { hidden: true }) || document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders quote summary on successful fetch (200)', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('123 Main St, Austin TX')).toBeInTheDocument();
  });

  it('renders expired screen on 401 with expired message', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 401, data: { message: 'Token has expired' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('This Quote Has Expired')).toBeInTheDocument();
    });
  });

  it('renders invalid screen on 401 with other message', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 401, data: { message: 'Invalid token' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Link Not Found')).toBeInTheDocument();
    });
  });

  it('renders already-signed screen on 409', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 409, data: { message: 'Already signed' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Already Signed')).toBeInTheDocument();
    });
  });

  it('submit button disabled when name is empty', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    expect(button).toBeDisabled();
  });

  it('submit button disabled when checkbox is unchecked', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    expect(button).toBeDisabled();
  });

  it('submit button disabled when canvas is blank', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    // Canvas not drawn on — button should still be disabled
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    expect(button).toBeDisabled();
  });

  it('successful submission transitions to success screen', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    (publicApi.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    // Fill name
    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');

    // Check agreement
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);

    // Simulate drawing on canvas
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    // Submit
    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Quote Accepted!')).toBeInTheDocument();
    });
  });

  it('rate limit (429) shows appropriate error message', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    (publicApi.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { status: 429, data: { message: 'Rate limited' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    // Fill form and draw
    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'John Smith');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Too many attempts. Please wait a moment and try again.');
    });
  });

  it('success screen shows signer name', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    (publicApi.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { success: true } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/your name/i);
    await userEvent.type(nameInput, 'Jane Doe');
    const checkbox = screen.getByRole('checkbox');
    await userEvent.click(checkbox);
    const canvas = document.querySelector('canvas')!;
    fireEvent.mouseDown(canvas, { clientX: 50, clientY: 50 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);

    const button = screen.getByRole('button', { name: /accept & sign quote/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Thank you, Jane Doe.')).toBeInTheDocument();
    });
  });

  it('no internal_notes rendered anywhere in the component', async () => {
    const quoteWithInternalNotes = {
      ...mockQuote,
      internal_notes: 'SECRET: give 20% discount next time',
    };
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: quoteWithInternalNotes });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });
    expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal_notes/)).not.toBeInTheDocument();
  });

  it('quote sections render in correct order with line items', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    // Both sections rendered
    expect(screen.getByText('Weekly Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Monthly Services')).toBeInTheDocument();

    // Line items rendered
    expect(screen.getByText('Mowing')).toBeInTheDocument();
    expect(screen.getByText('Edging')).toBeInTheDocument();
    expect(screen.getByText('Fertilization')).toBeInTheDocument();

    // Sections in order (Weekly before Monthly)
    const sections = screen.getAllByRole('heading', { level: 3 });
    expect(sections[0]).toHaveTextContent('Weekly Maintenance');
    expect(sections[1]).toHaveTextContent('Monthly Services');
  });

  it('currency values formatted correctly', async () => {
    (publicApi.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockQuote });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Quote Q-2026-001')).toBeInTheDocument();
    });

    // Check formatted values (USD with 2 decimals)
    expect(screen.getByText('$285.00')).toBeInTheDocument(); // subtotal
    expect(screen.getByText('$275.00')).toBeInTheDocument(); // total
    expect(screen.getByText('-$10.00')).toBeInTheDocument(); // discount
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd frontend && npx vitest run src/pages/signing/__tests__/SigningPage.test.tsx`
Expected: All 14 tests pass (some may need minor adjustments based on actual rendering)

- [ ] **Step 3: Run all existing tests to ensure no regressions**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/signing/__tests__/SigningPage.test.tsx
git commit -m "test(signing): add comprehensive test suite for signing page (14 cases)"
```

---

## Task 9: TypeScript Verification & Final Check

**Files:** None new — verification only.

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Run linting**

Run: `cd frontend && npm run lint`
Expected: No lint errors (fix any that appear)

- [ ] **Step 3: Run full test suite**

Run: `cd frontend && npx vitest run`
Expected: All tests pass including the 14 new signing page tests

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(signing): address lint/type issues from final verification"
```

---

## Notes

- The `publicApi` client intentionally has NO auth interceptors — this is critical for the signing page to work without login.
- Canvas `touch-action: none` CSS prevents page scrolling while drawing on mobile.
- The `fmt()` function uses `en-US` locale with USD currency and 2 decimal places per business requirement.
- The checkbox uses Radix UI's `onCheckedChange` which returns `boolean | 'indeterminate'` — we compare with `=== true`.
- All text inputs use `text-base` (16px) to prevent iOS zoom on focus.
- The submit button height is `h-12` (48px) exceeding the 44px minimum touch target.
