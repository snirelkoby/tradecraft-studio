import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUpdateTrade } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenshotUploadProps {
  tradeId: string;
  currentUrl?: string | null;
}

export function ScreenshotUpload({ tradeId, currentUrl }: ScreenshotUploadProps) {
  const { user } = useAuth();
  const updateTrade = useUpdateTrade();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${tradeId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('trade-screenshots')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('trade-screenshots')
        .getPublicUrl(path);

      await updateTrade.mutateAsync({ id: tradeId, screenshot_url: publicUrl });
      toast.success('Screenshot uploaded');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    await updateTrade.mutateAsync({ id: tradeId, screenshot_url: null });
    toast.success('Screenshot removed');
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      {currentUrl ? (
        <div className="relative">
          <img src={currentUrl} alt="Trade screenshot" className="rounded-lg border border-border max-h-48 object-cover w-full" />
          <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleRemove}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Camera className="h-3 w-3 mr-1" />
          {uploading ? 'Uploading...' : 'Add Screenshot'}
        </Button>
      )}
    </div>
  );
}
