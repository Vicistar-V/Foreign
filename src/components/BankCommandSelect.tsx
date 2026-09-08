import { useState, useMemo, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Use Vaul's NestedRoot so this drawer can open INSIDE the Moniepoint payment
// drawer. A plain Drawer.Root nested in another Drawer.Root breaks — the inner
// list never appears (which is why the bank list wasn't showing up).
const NestedDrawer = DrawerPrimitive.NestedRoot;

interface Bank {
  id: string;
  code: string;
  name: string;
  country: string;
}

// Top 20 most popular Nigerian banks
const TOP_NIGERIAN_BANKS = [
  '044', // Access Bank
  '063', // Access Bank (Diamond)
  '058', // Guaranty Trust Bank (GTBank)
  '057', // Zenith Bank
  '011', // First Bank
  '033', // United Bank for Africa (UBA)
  '214', // First City Monument Bank (FCMB)
  '221', // Stanbic IBTC Bank
  '070', // Fidelity Bank
  '050', // Ecobank
  '032', // Union Bank
  '215', // Unity Bank
  '035', // Wema Bank
  '232', // Sterling Bank
  '076', // Polaris Bank
  '030', // Heritage Bank
  '082', // Keystone Bank
  '101', // Providus Bank
  '068', // Standard Chartered
  '304', // Opay
];

interface BankCommandSelectProps {
  banks: Bank[];
  value: string;
  onValueChange: (code: string, name: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const BankCommandSelect = ({
  banks,
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Select your bank',
}: BankCommandSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isReady, setIsReady] = useState(false);
  const renderCountRef = useRef(0);
  const openTimeRef = useRef<number>(0);
  const parentRef = useRef<HTMLDivElement>(null);

  // 🔍 LOG: Component mount
  useEffect(() => {
    console.log('🏦 [BankCommandSelect] Component mounted');
    console.log(`📊 [BankCommandSelect] Total banks in props: ${banks.length}`);
    return () => {
      console.log('🏦 [BankCommandSelect] Component unmounted');
    };
  }, []);

  // 🔍 LOG: Track renders
  useEffect(() => {
    renderCountRef.current += 1;
    console.log(`🔄 [BankCommandSelect] Render #${renderCountRef.current}`);
  });

  // 🔍 LOG: Track drawer open/close
  useEffect(() => {
    if (open) {
      openTimeRef.current = performance.now();
      console.log('📂 [BankCommandSelect] Drawer OPENED');
      console.log(`🔍 [BankCommandSelect] Current search: "${search}"`);
    } else if (openTimeRef.current > 0) {
      const duration = performance.now() - openTimeRef.current;
      console.log(`📂 [BankCommandSelect] Drawer CLOSED (was open for ${duration.toFixed(2)}ms)`);
      openTimeRef.current = 0;
    }
  }, [open]);

  // 🔧 CHECK: Wait for parent dimensions before rendering virtual list
  useEffect(() => {
    if (open) {
      // Small delay to ensure drawer is fully mounted
      const mountDelay = setTimeout(() => {
        if (parentRef.current) {
          let attempts = 0;
          const maxAttempts = 60; // 60 frames = ~1 second max wait
          
          const checkDimensions = () => {
            attempts++;
            const rect = parentRef.current?.getBoundingClientRect();
            
            console.log(`⏳ [BankCommandSelect] Check #${attempts}: height=${rect?.height || 0}px, width=${rect?.width || 0}px`);
            
            if (rect && rect.height > 0) {
              setIsReady(true);
              console.log(`✅ [BankCommandSelect] Parent dimensions ready after ${attempts} attempts: ${rect.height}px height`);
            } else if (attempts >= maxAttempts) {
              console.error('❌ [BankCommandSelect] Failed to get parent dimensions after max attempts. Forcing ready state.');
              setIsReady(true); // Force it to prevent permanent loading
            } else {
              requestAnimationFrame(checkDimensions);
            }
          };
          
          checkDimensions();
        } else {
          console.error('❌ [BankCommandSelect] parentRef.current is null after mount delay!');
          setIsReady(true); // Force it to prevent permanent loading
        }
      }, 100); // 100ms delay for drawer animation to start
      
      return () => clearTimeout(mountDelay);
    } else {
      setIsReady(false);
    }
  }, [open]);

  // Get selected bank details
  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === value),
    [banks, value]
  );

  // Sort banks: popular first, then alphabetically
  const sortedBanks = useMemo(() => {
    const startTime = performance.now();
    
    // If searching, just filter normally (no special sorting)
    if (search) {
      const searchLower = search.toLowerCase();
      const filtered = banks.filter((bank) =>
        bank.name.toLowerCase().includes(searchLower)
      );
      const duration = performance.now() - startTime;
      console.log(`🔍 [BankCommandSelect] Filtered banks: ${filtered.length}/${banks.length} (took ${duration.toFixed(2)}ms)`);
      return filtered;
    }
    
    // No search: show popular banks first, then rest alphabetically
    const popularBanks: Bank[] = [];
    const otherBanks: Bank[] = [];
    
    banks.forEach((bank) => {
      if (TOP_NIGERIAN_BANKS.includes(bank.code)) {
        popularBanks.push(bank);
      } else {
        otherBanks.push(bank);
      }
    });
    
    // Sort popular banks to match the order in TOP_NIGERIAN_BANKS
    popularBanks.sort((a, b) => {
      const aIndex = TOP_NIGERIAN_BANKS.indexOf(a.code);
      const bIndex = TOP_NIGERIAN_BANKS.indexOf(b.code);
      return aIndex - bIndex;
    });
    
    const duration = performance.now() - startTime;
    console.log(`⭐ [BankCommandSelect] Sorted: ${popularBanks.length} popular + ${otherBanks.length} other (took ${duration.toFixed(2)}ms)`);
    
    return [...popularBanks, ...otherBanks];
  }, [banks, search]);

  // 🔍 LOG: Track search changes
  useEffect(() => {
    if (search) {
      console.log(`🔎 [BankCommandSelect] Search changed to: "${search}"`);
      console.log(`📊 [BankCommandSelect] Filtered results: ${sortedBanks.length} banks`);
    }
  }, [search, sortedBanks.length]);
  
  // Calculate section positions
  const popularCount = useMemo(() => {
    if (search) return 0; // No sections when searching
    return sortedBanks.filter((bank) => TOP_NIGERIAN_BANKS.includes(bank.code)).length;
  }, [sortedBanks, search]);

  const handleSelect = (currentCode: string) => {
    const bank = banks.find((b) => b.code === currentCode);
    if (bank) {
      console.log(`✅ [BankCommandSelect] Bank selected: ${bank.name} (${currentCode})`);
      onValueChange(currentCode, bank.name);
      setOpen(false);
      setSearch('');
    }
  };

  // Prepare items for virtualization (including headers)
  const virtualItems = useMemo(() => {
    if (search || popularCount === 0) {
      // No headers when searching or no popular banks
      return sortedBanks.map((bank, idx) => ({ type: 'bank' as const, bank, index: idx }));
    }
    
    // With headers: popular section + divider + rest
    const items: Array<{ type: 'header' | 'bank'; bank?: Bank; index: number; label?: string }> = [];
    
    // Popular header
    items.push({ type: 'header', index: 0, label: '⭐ Popular Banks' });
    
    // Popular banks
    sortedBanks.slice(0, popularCount).forEach((bank, idx) => {
      items.push({ type: 'bank', bank, index: idx + 1 });
    });
    
    // All banks header
    items.push({ type: 'header', index: popularCount + 1, label: '📋 All Banks (A-Z)' });
    
    // Remaining banks
    sortedBanks.slice(popularCount).forEach((bank, idx) => {
      items.push({ type: 'bank', bank, index: popularCount + 2 + idx });
    });
    
    return items;
  }, [sortedBanks, search, popularCount]);

  // TanStack Virtual setup
  const rowVirtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  return (
    <>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-label="Select a bank"
        className={cn(
          'w-full justify-between h-11 font-normal',
          !value && 'text-muted-foreground'
        )}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {selectedBank ? selectedBank.name : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <NestedDrawer open={open} onOpenChange={setOpen}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-[140] bg-black/80" />
          <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-[150] mt-24 flex h-auto max-h-[85vh] flex-col rounded-t-[10px] border bg-background">
            <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
            <div className="grid gap-1.5 p-4 text-center sm:text-left pb-3">
              <DrawerPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">Select Your Bank</DrawerPrimitive.Title>
              <DrawerPrimitive.Description className="text-sm text-muted-foreground">
                Search or scroll to find your bank
              </DrawerPrimitive.Description>
            </div>

          <div className="px-4 pb-6">
            {/* Search Input */}
            <div className="rounded-lg border bg-background">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  placeholder="Search banks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Virtualized List */}
              <div className="py-2">
                {sortedBanks.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No bank found.
                  </div>
                ) : (
                  <div
                    ref={parentRef}
                    className="h-[400px] overflow-auto"
                    style={{ contain: 'strict' }}
                  >
                    {!isReady ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-sm text-muted-foreground">Loading banks...</div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: `${rowVirtualizer.getTotalSize()}px`,
                          width: '100%',
                          position: 'relative',
                        }}
                      >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const item = virtualItems[virtualRow.index];
                        
                        if (item.type === 'header') {
                          return (
                            <div
                              key={virtualRow.key}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                              className="px-3 py-2 bg-muted/50"
                            >
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {item.label}
                              </p>
                            </div>
                          );
                        }
                        
                        const bank = item.bank!;
                        const isSelected = value === bank.code;
                        
                        return (
                          <div
                            key={virtualRow.key}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                            }}
                            onClick={() => handleSelect(bank.code)}
                            className="flex items-center px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4 shrink-0',
                                isSelected ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="flex-1 text-sm">{bank.name}</span>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-3 px-1">
              <p className="text-xs text-muted-foreground">
                {!search && popularCount > 0 ? (
                  <>
                    {popularCount} popular + {sortedBanks.length - popularCount} other banks
                  </>
                ) : (
                  <>
                    Showing {sortedBanks.length} of {banks.length} banks
                  </>
                )}
                {sortedBanks.length > 10 && (
                  <span className="ml-1 text-primary">
                    (Only rendering ~10-15 at a time ⚡)
                  </span>
                )}
              </p>
            </div>
          </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </NestedDrawer>
    </>
  );
};
