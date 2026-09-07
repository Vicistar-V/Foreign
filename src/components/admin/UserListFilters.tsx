import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, ArrowUpDown, Activity, Mail, Target, RotateCcw, Phone, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserListFilters } from '@/hooks/useAllUsers';

interface UserListFiltersProps {
  filters: UserListFilters;
  onFiltersChange: (filters: UserListFilters) => void;
}

const defaultFilters: UserListFilters = {
  search: '',
  membership_status: 'all',
  banned_status: 'all',
  activity_status: 'all',
  email_status: 'all',
  has_drops: 'all',
  phone_status: 'all',
  tour_status: 'all',
  sort_by: 'created_at',
  sort_order: 'desc'
};

export const UserListFiltersComponent = ({ filters, onFiltersChange }: UserListFiltersProps) => {
  const updateFilter = <K extends keyof UserListFilters>(key: K, value: UserListFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = 
    filters.membership_status !== 'all' ||
    filters.banned_status !== 'all' ||
    filters.activity_status !== 'all' ||
    filters.email_status !== 'all' ||
    filters.has_drops !== 'all' ||
    filters.phone_status !== 'all' ||
    filters.tour_status !== 'all' ||
    filters.search !== '';

  const resetFilters = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-10 h-11 bg-background"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Filter className="h-3 w-3" />
            Filters
          </h4>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>

        {/* Row 1: Main Filters */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select
            value={filters.membership_status}
            onValueChange={(value) => updateFilter('membership_status', value as UserListFilters['membership_status'])}
          >
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Filter className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Membership" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="member">Joined drop</SelectItem>
              <SelectItem value="not_member">Not joined</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.banned_status}
            onValueChange={(value) => updateFilter('banned_status', value as UserListFilters['banned_status'])}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              <SelectItem value="not_banned">Open</SelectItem>
              <SelectItem value="banned">Locked</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.activity_status}
            onValueChange={(value) => updateFilter('activity_status', value as UserListFilters['activity_status'])}
          >
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Activity className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Activity" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any time</SelectItem>
              <SelectItem value="active">Online now</SelectItem>
              <SelectItem value="idle">Recent</SelectItem>
              <SelectItem value="dormant">Offline</SelectItem>
              <SelectItem value="never">Never</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: More Filters + Sort */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Select
            value={filters.email_status}
            onValueChange={(value) => updateFilter('email_status', value as UserListFilters['email_status'])}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Email" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any email</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.has_drops}
            onValueChange={(value) => updateFilter('has_drops', value as UserListFilters['has_drops'])}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Target className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Drops" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Drops or no</SelectItem>
              <SelectItem value="yes">Joined</SelectItem>
              <SelectItem value="no">Never</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.phone_status}
            onValueChange={(value) => updateFilter('phone_status', value as UserListFilters['phone_status'])}
          >
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Phone" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any phone</SelectItem>
              <SelectItem value="has_phone">Added</SelectItem>
              <SelectItem value="no_phone">None</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.tour_status}
            onValueChange={(value) => updateFilter('tour_status', value as UserListFilters['tour_status'])}
          >
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <Compass className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Walkthrough" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="never_started">Skipped</SelectItem>
              <SelectItem value="in_progress">Started</SelectItem>
              <SelectItem value="completed">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={`${filters.sort_by}-${filters.sort_order}`}
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split('-') as [UserListFilters['sort_by'], UserListFilters['sort_order']];
              onFiltersChange({ ...filters, sort_by: sortBy, sort_order: sortOrder });
            }}
          >
            <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
              <div className="flex items-center gap-2 truncate">
                <ArrowUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at-desc">Newest First</SelectItem>
              <SelectItem value="created_at-asc">Oldest First</SelectItem>
              <SelectItem value="last_active-desc">Recent Activity</SelectItem>
              <SelectItem value="last_active-asc">Least Active</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="earnings-desc">Top Earnings</SelectItem>
              <SelectItem value="earnings-asc">Low Earnings</SelectItem>
              <SelectItem value="referrals-desc">Top Referrals</SelectItem>
              <SelectItem value="referrals-asc">Low Referrals</SelectItem>
              <SelectItem value="drops-desc">Most Drops</SelectItem>
              <SelectItem value="drops-asc">Fewest Drops</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
