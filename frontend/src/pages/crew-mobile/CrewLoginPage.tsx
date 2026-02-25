import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trees } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useTranslation } from '@/hooks/useTranslation';
import { apiClient } from '@/api/client';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function CrewLoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { language, setLanguage } = useLanguageStore();
  const t = useTranslation();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      const res = await apiClient.post('/auth/login', data);
      const { accessToken, user } = res.data.data;
      const isCrew = user.roles?.some((r: { role: string }) =>
        ['crew_leader', 'crew_member'].includes(r.role),
      );
      if (!isCrew) {
        setError(t.loginFailed);
        return;
      }
      setAuth(accessToken, user);
      navigate('/crew/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || t.loginFailed);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Trees className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t.crewPortal}</CardTitle>
          {/* Language toggle */}
          <div className="mt-2 flex justify-center gap-2">
            <button
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                language === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => setLanguage('en')}
            >
              {t.english}
            </button>
            <button
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                language === 'es' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => setLanguage('es')}
            >
              {t.spanish}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">{t.email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-12 text-base"
                {...register('email')}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">{t.password}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="h-12 text-base"
                {...register('password')}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={isSubmitting}>
              {isSubmitting ? t.signingIn : t.signIn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
