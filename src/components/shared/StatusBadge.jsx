import React from 'react';

const colorMap = {
  available: 'dark:bg-green-950/40 dark:text-green-300 dark:border-green-600 light:bg-green-50 light:text-green-700 light:border-green-300',
  rented: 'dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600 light:bg-blue-50 light:text-blue-700 light:border-blue-300',
  overdue: 'dark:bg-red-950/40 dark:text-red-300 dark:border-red-600 light:bg-red-50 light:text-red-700 light:border-red-300',
  maintenance: 'dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-600 light:bg-amber-50 light:text-amber-700 light:border-amber-300',
  active: 'dark:bg-green-950/40 dark:text-green-300 dark:border-green-600 light:bg-green-50 light:text-green-700 light:border-green-300',
  upcoming: 'dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600 light:bg-blue-50 light:text-blue-700 light:border-blue-300',
  completed: 'dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-600 light:bg-purple-50 light:text-purple-700 light:border-purple-300',
  extended: 'dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-600 light:bg-amber-50 light:text-amber-700 light:border-amber-300',
  cancelled: 'dark:bg-red-950/40 dark:text-red-300 dark:border-red-600 light:bg-red-50 light:text-red-700 light:border-red-300',
  signed: 'dark:bg-green-950/40 dark:text-green-300 dark:border-green-600 light:bg-green-50 light:text-green-700 light:border-green-300',
  pending: 'dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-600 light:bg-amber-50 light:text-amber-700 light:border-amber-300',
  expired: 'dark:bg-red-950/40 dark:text-red-300 dark:border-red-600 light:bg-red-50 light:text-red-700 light:border-red-300',
  not_started: 'dark:bg-secondary dark:text-secondary-foreground dark:border-border light:bg-gray-100 light:text-gray-700 light:border-gray-300',
  pdf_generated: 'dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-600 light:bg-blue-50 light:text-blue-700 light:border-blue-300',
  sent_to_agency: 'dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-600 light:bg-purple-50 light:text-purple-700 light:border-purple-300',
  sent_to_renter: 'dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-600 light:bg-amber-50 light:text-amber-700 light:border-amber-300',
  recovered: 'dark:bg-green-950/40 dark:text-green-300 dark:border-green-600 light:bg-green-50 light:text-green-700 light:border-green-300',
  lost: 'dark:bg-red-950/40 dark:text-red-300 dark:border-red-600 light:bg-red-50 light:text-red-700 light:border-red-300',
};

const labelMap = {
  available: '✅ Available',
  rented: '🚗 Rented',
  overdue: '🚨 Overdue',
  maintenance: '🔧 Maintenance',
  not_started: '⏳ Not Started',
  pdf_generated: '📄 PDF Ready',
  sent_to_agency: '📬 Sent to Agency',
  sent_to_renter: '📧 Sent to Renter',
  recovered: '💰 Recovered',
  lost: '❌ Lost',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${colorMap[status] || 'bg-secondary text-secondary-foreground border-border'}`}>
      {labelMap[status] || status?.replace(/_/g, ' ')}
    </span>
  );
}