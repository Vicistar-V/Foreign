import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Download, Copy, FileText, X, Loader2, Users, UserCheck, UserX } from 'lucide-react';

interface ExportPhoneNumbersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type MembershipFilter = 'all' | 'member' | 'not_member';
type ExportFormat = 'clipboard' | 'csv' | 'txt';

export const ExportPhoneNumbersDrawer = ({ open, onOpenChange }: ExportPhoneNumbersDrawerProps) => {
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchPhoneNumbers = async () => {
    setIsExporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('You must be logged in');
        return;
      }

      const response = await supabase.functions.invoke('get-all-users', {
        body: {
          membership_status: membershipFilter,
          export_mode: true
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const numbers = response.data?.phone_numbers || [];
      setPhoneNumbers(numbers);
      setHasFetched(true);

      if (numbers.length === 0) {
        toast.info('No phone numbers found for this filter');
      } else {
        toast.success(`Found ${numbers.length} phone numbers`);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to fetch phone numbers');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = () => {
    if (phoneNumbers.length === 0) return;
    const text = phoneNumbers.join(', ');
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${phoneNumbers.length} phone numbers to clipboard`);
  };

  const downloadAsCsv = () => {
    if (phoneNumbers.length === 0) return;
    const csv = 'Phone Number\n' + phoneNumbers.join('\n');
    downloadFile(csv, `phone_numbers_${membershipFilter}_${Date.now()}.csv`, 'text/csv');
  };

  const downloadAsTxt = () => {
    if (phoneNumbers.length === 0) return;
    const txt = phoneNumbers.join('\n');
    downloadFile(txt, `phone_numbers_${membershipFilter}_${Date.now()}.txt`, 'text/plain');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setPhoneNumbers([]);
      setHasFetched(false);
      setMembershipFilter('all');
    }
    onOpenChange(newOpen);
  };

  const getMembershipLabel = () => {
    switch (membershipFilter) {
      case 'member': return 'Activated Members';
      case 'not_member': return 'Non-Activated Users';
      default: return 'All Users';
    }
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DrawerTitle>Export Phone Numbers</DrawerTitle>
                <p className="text-sm text-muted-foreground">Download or copy user phone numbers</p>
              </div>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="p-4 space-y-6">
          {/* Step 1: Choose User Type */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Step 1: Choose Users</h3>
            <RadioGroup
              value={membershipFilter}
              onValueChange={(v) => {
                setMembershipFilter(v as MembershipFilter);
                setHasFetched(false);
                setPhoneNumbers([]);
              }}
              className="grid gap-2"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  All Users
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="member" id="member" />
                <Label htmlFor="member" className="flex items-center gap-2 cursor-pointer flex-1">
                  <UserCheck className="h-4 w-4 text-success" />
                  Activated Members Only
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="not_member" id="not_member" />
                <Label htmlFor="not_member" className="flex items-center gap-2 cursor-pointer flex-1">
                  <UserX className="h-4 w-4 text-warning" />
                  Non-Activated Users Only
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Step 2: Fetch */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Step 2: Fetch Phone Numbers</h3>
            <Button 
              onClick={fetchPhoneNumbers} 
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Fetch {getMembershipLabel()} Phone Numbers
                </>
              )}
            </Button>
          </div>

          {/* Step 3: Export Options */}
          {hasFetched && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">
                Step 3: Export ({phoneNumbers.length} numbers found)
              </h3>
              
              {phoneNumbers.length > 0 ? (
                <div className="grid gap-2">
                  <Button 
                    variant="outline" 
                    onClick={copyToClipboard}
                    className="w-full justify-start"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard (comma-separated)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={downloadAsCsv}
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download as CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={downloadAsTxt}
                    className="w-full justify-start"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download as TXT (one per line)
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No phone numbers found for this filter
                </div>
              )}

              {/* Preview */}
              {phoneNumbers.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Preview (first 10):</p>
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono max-h-32 overflow-y-auto">
                    {phoneNumbers.slice(0, 10).map((num, i) => (
                      <div key={i}>{num}</div>
                    ))}
                    {phoneNumbers.length > 10 && (
                      <div className="text-muted-foreground mt-1">...and {phoneNumbers.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
