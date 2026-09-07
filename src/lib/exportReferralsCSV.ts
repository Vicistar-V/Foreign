import { formatNigerianDate } from './nigerianTime';

interface Referral {
  id: string;
  firstName: string;
  email: string;
  joinedDate: string;
  activatedDate: string | null;
  isMember: boolean;
  bonusEarned: number;
}

export const exportReferralsToCSV = (referrals: Referral[]) => {
  if (!referrals || referrals.length === 0) {
    console.warn('No referrals to export');
    return;
  }

  const headers = ['Name', 'Email', 'Status', 'Joined Date', 'Activated Date', 'Bonus Earned'];

  const rows = referrals.map(r => [
    r.firstName,
    r.email,
    r.isMember ? 'Active' : 'Pending',
    formatNigerianDate(r.joinedDate),
    r.activatedDate ? formatNigerianDate(r.activatedDate) : '—',
    r.isMember ? `₦${r.bonusEarned.toLocaleString()}` : '₦0'
  ]);

  // Escape double quotes and wrap fields in quotes
  const escapeCsvField = (field: string) => `"${String(field).replace(/"/g, '""')}"`;

  const csvContent = [
    headers.map(escapeCsvField).join(','),
    ...rows.map(row => row.map(escapeCsvField).join(','))
  ].join('\n');

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = `referrals-${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
  
  console.log(`Exported ${referrals.length} referrals to CSV`);
};
