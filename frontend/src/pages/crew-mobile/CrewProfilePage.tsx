import { useNavigate } from 'react-router-dom';
import { LogOut, User, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/authStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useTranslation } from '@/hooks/useTranslation';
import { apiClient } from '@/api/client';

export default function CrewProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { language, setLanguage } = useLanguageStore();
  const t = useTranslation();

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : '??';

  const primaryRole = user?.roles[0]?.role.replace(/_/g, ' ') ?? 'Crew';

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // proceed even if API call fails
    }
    clearAuth();
    navigate('/crew/login');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{t.myProfile}</h1>

      {/* Profile Card */}
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xl font-bold">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="text-sm capitalize text-muted-foreground">{primaryRole}</p>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t.language}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <button
              className={`flex-1 rounded-lg border-2 p-4 text-center font-medium transition-colors ${
                language === 'en'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
              onClick={() => setLanguage('en')}
            >
              <User className="mx-auto mb-1 h-5 w-5" />
              {t.english}
            </button>
            <button
              className={`flex-1 rounded-lg border-2 p-4 text-center font-medium transition-colors ${
                language === 'es'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
              onClick={() => setLanguage('es')}
            >
              <Globe className="mx-auto mb-1 h-5 w-5" />
              {t.spanish}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Button
        variant="destructive"
        className="w-full h-14 text-lg font-bold"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-5 w-5" />
        {t.logOut}
      </Button>
    </div>
  );
}
