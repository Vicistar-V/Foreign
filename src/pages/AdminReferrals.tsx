import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  GitBranch, 
  Search, 
  ChevronRight,
  Users,
  Coins,
  Calendar,
  Crown,
  UserCheck,
  UserX
} from 'lucide-react';
import { fmtDate } from '@/lib/formatLagos';
import { useReferralTree, ReferralNode } from '@/hooks/useReferralTree';
import { AvatarPreviewDrawer } from '@/components/results/AvatarPreviewDrawer';

function ReferralTreeNode({ 
  node, 
  depth = 0, 
  onSelectUser,
  onAvatarClick
}: { 
  node: ReferralNode; 
  depth?: number;
  onSelectUser: (userId: string) => void;
  onAvatarClick: (name: string, avatarUrl: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className={depth > 0 ? 'ml-3 md:ml-6 border-l-2 border-muted/30 pl-3 md:pl-4' : ''}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-start gap-2 md:gap-3 py-3">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:h-6 md:w-6 shrink-0 mt-0.5">
                <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}

          <Avatar 
            className="h-10 w-10 shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              onAvatarClick(node.full_name, node.avatar_url);
            }}
          >
            <AvatarImage src={node.avatar_url || undefined} />
            <AvatarFallback>{node.full_name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onSelectUser(node.id)}
                className="font-semibold truncate block w-full hover:underline hover:text-primary text-left transition-colors"
              >
                {node.full_name}
              </button>
              {node.is_member ? (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Active Member
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                  <UserX className="w-3 h-3 mr-1" />
                  Not Registered
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3 mt-1 text-xs md:text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmtDate(node.created_at)}
              </span>
              {node.referral_count > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <Users className="h-3 w-3" />
                  {node.referral_count.toLocaleString()} invited
                </span>
              )}
              {node.earnings_generated > 0 && (
                <span className="flex items-center gap-1 text-success tabular-nums">
                  <Coins className="h-3 w-3" />
                  ₦{node.earnings_generated.toLocaleString()}
                </span>
              )}
            </div>

            <div className="mt-1">
              <code className="text-[10px] bg-muted/50 border border-border/50 px-1.5 py-0.5 rounded uppercase tracking-wider font-medium">{node.referral_code}</code>
            </div>
          </div>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            <div className="space-y-1">
              {node.children.map((child) => (
                <ReferralTreeNode 
                  key={child.id} 
                  node={child} 
                  depth={depth + 1}
                  onSelectUser={onSelectUser}
                  onAvatarClick={onAvatarClick}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

export default function AdminReferrals() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [previewUser, setPreviewUser] = useState<{ name: string; avatarUrl: string | null } | null>(null);

  const { data, isLoading, error } = useReferralTree(submittedQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  const handleSelectUser = (userId: string) => {
    navigate(`/admin/users/${userId}?from=referrals`);
  };

  const handleAvatarClick = (name: string, avatarUrl: string | null) => {
    setPreviewUser({ name, avatarUrl });
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <GitBranch className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold">Community Tree</h1>
          <p className="text-xs md:text-sm text-muted-foreground">See who invited who and how the family is growing</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or invite code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={!searchQuery.trim()}>
          Search
        </Button>
      </form>

      {/* Results */}
      {!submittedQuery ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">Who are we looking for?</h3>
            <p className="text-sm text-muted-foreground">Enter a name or invite code to see their friends and family tree</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : data?.error || !data?.tree ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">We couldn't find them</h3>
            <p className="text-sm text-muted-foreground">Check the spelling of the name or code and try again</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <Card>
              <CardContent className="p-3 md:p-4 text-center">
                <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl md:text-2xl font-bold tabular-nums">{data.stats?.direct_referrals || 0}</p>
                <p className="text-xs md:text-xs text-muted-foreground">Direct invites</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4 text-center">
                <GitBranch className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xl md:text-2xl font-bold tabular-nums">{data.stats?.total_in_tree || 0}</p>
                <p className="text-xs md:text-xs text-muted-foreground">Whole network</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 md:p-4 text-center">
                <Coins className="h-5 w-5 mx-auto text-success mb-1" />
                <p className="text-xl md:text-2xl font-bold text-success tabular-nums">₦{(data.stats?.total_earnings || 0).toLocaleString()}</p>
                <p className="text-xs md:text-xs text-muted-foreground">Earned for them</p>
              </CardContent>
            </Card>
          </div>

          {/* Referred By */}
          {data.referredBy && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <p className="text-xs md:text-sm text-muted-foreground mb-2">This person was invited by:</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <Crown className="h-5 w-5 text-warning" />
                  <span className="font-semibold">{data.referredBy.full_name}</span>
                  <code className="text-xs bg-muted px-2 py-0.5 rounded">{data.referredBy.referral_code}</code>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tree */}
          <Card>
            <CardContent className="p-4">
              <ReferralTreeNode 
                node={data.tree} 
                onSelectUser={handleSelectUser}
                onAvatarClick={handleAvatarClick}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Avatar Preview Drawer */}
      <AvatarPreviewDrawer
        isOpen={!!previewUser}
        onClose={() => setPreviewUser(null)}
        name={previewUser?.name || ''}
        avatarUrl={previewUser?.avatarUrl}
      />
    </div>
  );
}
