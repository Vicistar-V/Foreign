interface Transaction {
  created_at: string;
  transaction_type: string;
  wallet_type: string;
  amount: number;
  status: string;
  description: string;
}

export const exportTransactionsToCSV = (transactions: Transaction[]) => {
  if (!transactions || transactions.length === 0) {
    console.warn('No transactions to export');
    return;
  }

  const headers = ['Date', 'Type', 'Wallet', 'Amount', 'Status', 'Description'];

  const rows = transactions.map(t => [
    new Date(t.created_at).toLocaleString('en-NG', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    t.transaction_type.replace(/_/g, ' '),
    t.wallet_type,
    `₦${Math.abs(t.amount).toLocaleString()}`,
    t.status,
    t.description
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
  link.download = `viketa-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  window.URL.revokeObjectURL(url);
  
  console.log(`Exported ${transactions.length} transactions to CSV`);
};
