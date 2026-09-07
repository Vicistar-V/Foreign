import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Download, Search, X, ImageIcon, ExternalLink, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

// Import all flyers from the assets folder
import flyerV1 from '@/assets/flyers/viketa-daily-drop-flyer.png';
import flyerV2 from '@/assets/flyers/viketa-daily-drop-flyer-v2.png';
import flyerBase from '@/assets/flyers/viketa-flyer-base.png';
import flyerPayoutSuccess from '@/assets/flyers/viketa-payout-success-flyer.png';
import flyerOgMain from '@/assets/flyers/viketa-og-main-flyer.png';

interface FlyerItem {
  id: string;
  name: string;
  description: string;
  image: string;
  category: 'marketing' | 'social' | 'promo';
  createdAt: string;
}

// Gallery items - add new flyers here
const galleryItems: FlyerItem[] = [
  {
    id: 'flyer-og-main',
    name: 'Main OG Flyer (Social Share)',
    description: 'Premium marketing flyer used for all social media sharing - Credit Alert ₦45,000 with shield protection',
    image: flyerOgMain,
    category: 'marketing',
    createdAt: '2024-12-31',
  },
  {
    id: 'flyer-v1',
    name: 'Daily Drop Flyer v1',
    description: 'Main marketing flyer with phone, coins, and bullet points',
    image: flyerV1,
    category: 'marketing',
    createdAt: '2024-12-31',
  },
  {
    id: 'flyer-v2',
    name: 'Daily Drop Flyer v2',
    description: 'Updated flyer with shield icons and credit alert focus',
    image: flyerV2,
    category: 'marketing',
    createdAt: '2024-12-31',
  },
  {
    id: 'flyer-base',
    name: 'Clean Base Template',
    description: 'Clean background without text - add your own text in Canva',
    image: flyerBase,
    category: 'marketing',
    createdAt: '2024-12-31',
  },
  {
    id: 'flyer-payout-success',
    name: 'Payout Success Flyer',
    description: 'Premium 3D phone with "Payout Successful" screen, shields and Naira symbols - perfect for Canva overlay',
    image: flyerPayoutSuccess,
    category: 'marketing',
    createdAt: '2024-12-31',
  },
];

export default function AdminGallery() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<FlyerItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter flyers based on search
  const filteredItems = galleryItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Download image
  const handleDownload = (item: FlyerItem) => {
    const link = document.createElement('a');
    link.href = item.image;
    link.download = `${item.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloading ${item.name}`);
  };

  // Copy image URL
  const handleCopyUrl = async (item: FlyerItem) => {
    try {
      // Get the full URL
      const fullUrl = window.location.origin + item.image;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(item.id);
      toast.success('Link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  // Open image in new tab
  const handleOpenNew = (item: FlyerItem) => {
    window.open(item.image, '_blank');
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-5 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Marketing Flyers</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Download & share — perfect for WhatsApp status
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search flyers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <ImageIcon className="h-4 w-4 md:h-5 md:w-5 mx-auto text-primary mb-1" />
            <p className="text-lg md:text-xl font-bold tabular-nums">{galleryItems.length}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">All Flyers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ImageIcon className="h-4 w-4 md:h-5 md:w-5 mx-auto text-info mb-1" />
            <p className="text-lg md:text-xl font-bold tabular-nums">
              {galleryItems.filter(i => i.category === 'marketing').length}
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">Marketing</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <ImageIcon className="h-4 w-4 md:h-5 md:w-5 mx-auto text-accent-orange mb-1" />
            <p className="text-lg md:text-xl font-bold tabular-nums">
              {galleryItems.filter(i => i.category === 'social').length}
            </p>
            <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">Social</p>
          </CardContent>
        </Card>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No flyers found</p>
            </CardContent>
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            >
              {/* Image Preview */}
              <div 
                className="relative aspect-[9/16] bg-muted overflow-hidden"
                onClick={() => setSelectedImage(item)}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium text-sm bg-black/50 px-3 py-1.5 rounded-full">
                    Click to preview
                  </span>
                </div>
              </div>
              
              {/* Info */}
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm font-semibold truncate">{item.name}</CardTitle>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
              </CardHeader>
              
              {/* Actions */}
              <CardContent className="p-3 pt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(item);
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyUrl(item);
                  }}
                >
                  {copiedId === item.id ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNew(item);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Fullscreen Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {selectedImage?.name || 'Flyer Preview'}
          </DialogTitle>
          {selectedImage && (
            <div className="relative w-full h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-background">
                <div>
                  <h3 className="font-semibold">{selectedImage.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedImage.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(selectedImage)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Image */}
              <div className="flex-1 overflow-auto bg-muted/50 flex items-center justify-center p-4">
                <img
                  src={selectedImage.image}
                  alt={selectedImage.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
