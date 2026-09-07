import { useState, useRef, useEffect } from 'react';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Images,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  X,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/imageCompression';
import { UserAvatar } from '@/components/results/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { onboardingSkip } from '@/lib/onboardingSkip';

// sessionStorage keys for persisting upload state across page reloads
const STORAGE_KEY = 'pendingAvatarUpload';
const RETURN_TO_KEY = 'avatarUploadReturnTo';
const CAMERA_OPENED_KEY = 'cameraOpened';

export default function SetProfilePicture() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const wantsToChange = searchParams.get('change') === 'true';
  const hasExistingPicture = !!profile?.avatar_url;
  const showAlreadyHasPicture = hasExistingPicture && !wantsToChange;

  const returnTo =
    location.state?.from || sessionStorage.getItem(RETURN_TO_KEY) || '/dashboard';

  useEffect(() => {
    if (!profileLoading && profile && !profile.is_member) {
      navigate('/dashboard', { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  useEffect(() => {
    const savedImage = sessionStorage.getItem(STORAGE_KEY);
    if (savedImage && !showAlreadyHasPicture) {
      setPreviewUrl(savedImage);
    }
  }, [showAlreadyHasPicture]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Wrong file type',
        description: 'Please upload a JPG, PNG or WEBP image',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too big',
        description: 'Please pick an image under 10MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setIsCompressing(true);
    try {
      const compressedDataUrl = await compressImage(file);
      setPreviewUrl(compressedDataUrl);
      sessionStorage.setItem(STORAGE_KEY, compressedDataUrl);
    } catch (error) {
      console.error('Compression error:', error);
      toast({
        title: 'Could not read that photo',
        description: 'Please try another one',
        variant: 'destructive',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = async () => {
    if (!previewUrl) return;
    setIsUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-avatar', {
        body: {
          imageData: previewUrl,
          fileName: selectedFile?.name || 'profile-picture.jpg',
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Upload failed');

      toast({ title: 'Saved!', description: 'Your picture is set' });

      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
      sessionStorage.removeItem(CAMERA_OPENED_KEY);

      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });

      navigate(returnTo, { replace: true });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openCamera = () => {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
    sessionStorage.setItem(CAMERA_OPENED_KEY, 'true');
    cameraInputRef.current?.click();
  };

  const openGallery = () => {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
    galleryInputRef.current?.click();
  };

  const handleRemovePreview = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  // Loading state — compact
  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 pt-10 space-y-5">
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-40 w-40 rounded-full mx-auto" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (profile && !profile.is_member) return null;

  // ==== Already has picture: compact confirm view ====
  if (showAlreadyHasPicture) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 pt-8 pb-10 space-y-6">
          <header className="text-center space-y-1">
            <h1 className="text-xl font-bold text-foreground">Your picture</h1>
            <p className="text-xs text-muted-foreground">
              This is how friends see you
            </p>
          </header>

          <motion.button
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAvatarPreview(true)}
            className="mx-auto block relative"
            aria-label="Preview picture"
          >
            <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-500/40 to-primary/30 blur-md" />
            <div className="relative ring-2 ring-amber-500/40 rounded-full">
              <UserAvatar
                name={profile?.full_name || 'User'}
                avatarUrl={profile?.avatar_url}
                size="xl"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-success flex items-center justify-center ring-4 ring-background">
              <CheckCircle2 className="h-4 w-4 text-white" />
            </div>
          </motion.button>

          <p className="text-center text-sm font-medium text-foreground">
            {profile?.full_name}
          </p>

          <AvatarPreviewDrawer
            isOpen={showAvatarPreview}
            onClose={() => setShowAvatarPreview(false)}
            name={profile?.full_name || 'User'}
            avatarUrl={profile?.avatar_url}
            role="yield_collector"
          />

          <div className="space-y-2 pt-2">
            <Button
              onClick={() => navigate('/dashboard')}
              className="w-full h-11 font-semibold"
            >
              Done
            </Button>
            <Button
              onClick={() =>
                navigate('/set-profile-picture?change=true', {
                  state: { from: returnTo },
                  replace: true,
                })
              }
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Change picture
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ==== Upload / change view: single focal circle ====
  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        {/* Compact header row */}
        <header className="flex items-center justify-between">
          {hasExistingPicture ? (
            <button
              onClick={() => navigate(returnTo)}
              className="h-9 px-2 -ml-2 rounded-full flex items-center gap-1 text-muted-foreground hover:bg-muted"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-9 w-9" />
          )}
          <h1 className="text-sm font-semibold text-foreground">
            {hasExistingPicture ? 'Change picture' : 'Add your picture'}
          </h1>
          {hasExistingPicture ? (
            <div className="h-9 w-9" />
          ) : (
            <button
              onClick={() => {
                onboardingSkip.skipAvatar();
                navigate('/dashboard');
              }}
              className="h-9 px-3 -mr-2 rounded-full text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Skip
            </button>
          )}
        </header>

        <p className="text-center text-xs text-muted-foreground -mt-2">
          Use a real photo of your face — no fakes.
        </p>

        {/* THE ONE FOCAL POINT: giant tappable circle */}
        <div className="flex flex-col items-center pt-2">
          <motion.button
            onClick={() => (previewUrl ? setShowAvatarPreview(true) : openGallery())}
            whileTap={{ scale: 0.97 }}
            disabled={isCompressing}
            className="relative"
            aria-label={previewUrl ? 'Preview picture' : 'Choose photo'}
          >
            {previewUrl ? (
              <>
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-500/40 to-primary/30 blur-md" />
                <Avatar className="relative h-40 w-40 ring-2 ring-amber-500/50">
                  <AvatarImage
                    src={previewUrl}
                    alt="Preview"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-amber-500/10">
                    <Camera className="h-10 w-10 text-amber-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-success flex items-center justify-center ring-4 ring-background">
                  <CheckCircle2 className="h-4 w-4 text-white" />
                </div>
              </>
            ) : (
              <div className="h-40 w-40 rounded-full border-2 border-dashed border-amber-500/40 bg-amber-500/5 flex flex-col items-center justify-center gap-2">
                {isCompressing ? (
                  <>
                    <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
                    <span className="text-xs text-muted-foreground">Preparing…</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-9 w-9 text-amber-500" />
                    <span className="text-xs font-medium text-foreground">
                      Tap to add
                    </span>
                  </>
                )}
              </div>
            )}
          </motion.button>

          {previewUrl && (
            <button
              onClick={handleRemovePreview}
              className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Source pickers — only when no preview */}
        {!previewUrl && (
          <div className="pt-2">
            {isMobile ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={openCamera}
                  disabled={isCompressing}
                  className="h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  Camera
                </button>
                <button
                  onClick={openGallery}
                  disabled={isCompressing}
                  className="h-12 rounded-xl bg-muted border border-border flex items-center justify-center gap-2 text-sm font-medium text-foreground disabled:opacity-50"
                >
                  <Images className="h-4 w-4" />
                  Gallery
                </button>
              </div>
            ) : (
              <Button
                onClick={openGallery}
                disabled={isCompressing}
                className="w-full h-12 font-semibold"
              >
                <Images className="mr-2 h-5 w-5" />
                {isCompressing ? 'Preparing…' : 'Choose photo'}
              </Button>
            )}
          </div>
        )}

        {hasExistingPicture && !previewUrl && (
          <Button
            onClick={() => navigate(returnTo)}
            variant="ghost"
            className="w-full h-10 text-sm text-muted-foreground"
          >
            Cancel
          </Button>
        )}
      </div>

      <AvatarPreviewDrawer
        isOpen={showAvatarPreview}
        onClose={() => setShowAvatarPreview(false)}
        name={profile?.full_name || 'User'}
        avatarUrl={previewUrl}
        role="yield_collector"
      />

      {/* Sticky save — only when a preview exists */}
      {previewUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-x-0 bottom-20 z-40 px-4"
        >
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full h-12 font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-lg border-0"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Save picture
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
