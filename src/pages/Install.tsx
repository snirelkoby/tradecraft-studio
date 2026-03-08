import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor, Apple, Chrome, Share2, MoreVertical, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios');
    else if (/android/.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <Download className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">התקן את EdgeLab</h1>
        <p className="text-muted-foreground">
          התקן את האפליקציה על המכשיר שלך לגישה מהירה — בדיוק כמו אפליקציה רגילה
        </p>
      </div>

      {isInstalled && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6 text-center">
            <p className="text-primary font-semibold text-lg">✅ האפליקציה כבר מותקנת!</p>
            <p className="text-muted-foreground text-sm mt-1">אתה כבר משתמש ב-EdgeLab כאפליקציה</p>
          </CardContent>
        </Card>
      )}

      {deferredPrompt && !isInstalled && (
        <Card className="border-primary/50">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="font-medium">ניתן להתקין ישירות 🎉</p>
            <Button size="lg" onClick={handleInstall} className="gap-2">
              <Download className="h-5 w-5" />
              התקן עכשיו
            </Button>
          </CardContent>
        </Card>
      )}

      {/* iOS Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Apple className="h-5 w-5" />
            iPhone / iPad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground" dir="rtl">
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">1</span>
              <span>פתח את האפליקציה ב-<strong className="text-foreground">Safari</strong> (חובה — לא עובד מדפדפנים אחרים)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">2</span>
              <span className="flex items-center gap-1">לחץ על כפתור השיתוף <Share2 className="h-4 w-4 inline text-foreground" /> בתחתית המסך</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">3</span>
              <span className="flex items-center gap-1">גלול למטה ובחר <strong className="text-foreground">"Add to Home Screen"</strong> <PlusSquare className="h-4 w-4 inline text-foreground" /></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">4</span>
              <span>לחץ <strong className="text-foreground">"Add"</strong> — האפליקציה תופיע במסך הבית</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Android Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-5 w-5" />
            Android
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground" dir="rtl">
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">1</span>
              <span>פתח את האפליקציה ב-<strong className="text-foreground">Chrome</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">2</span>
              <span className="flex items-center gap-1">לחץ על תפריט <MoreVertical className="h-4 w-4 inline text-foreground" /> (שלוש נקודות למעלה)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">3</span>
              <span>בחר <strong className="text-foreground">"Install app"</strong> או <strong className="text-foreground">"Add to Home screen"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">4</span>
              <span>אשר — האפליקציה תופיע כאייקון במסך הבית</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Desktop Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-5 w-5" />
            מחשב (Chrome / Edge)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground" dir="rtl">
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">1</span>
              <span>פתח את האפליקציה ב-Chrome או Edge</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">2</span>
              <span className="flex items-center gap-1">לחץ על אייקון ההתקנה <Download className="h-4 w-4 inline text-foreground" /> בשורת הכתובת</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs shrink-0">3</span>
              <span>לחץ <strong className="text-foreground">"Install"</strong> — האפליקציה תיפתח כחלון עצמאי</span>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground space-y-1">
          <p>💡 האפליקציה עובדת אופליין ונטענת מהר יותר כשמותקנת</p>
          <p>🔄 עדכונים מותקנים אוטומטית ברקע</p>
        </CardContent>
      </Card>
    </div>
  );
});

export default Install;
