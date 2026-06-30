import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Upload, Calculator, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Banknote, Users, UserCheck, Building2, Mail, ClipboardList, Settings, DollarSign, Eye, History, GitBranch, Database, Activity, FileCode, BookOpen, Lock } from 'lucide-react';
import { useAdminLock } from '@/hooks/useAdminLock';

const primaryTabs = [
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/payroll', label: 'Payroll', icon: Calculator },
];

const moreItems = [
  { path: '/backend', label: 'Backend Money', icon: DollarSign },
  { path: '/advances', label: 'Advances', icon: Banknote },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/fee-intercept', label: 'Fee Intercept', icon: DollarSign },
  { path: '/preparers', label: 'Preparers', icon: UserCheck },
  { path: '/offices', label: 'Offices', icon: Building2 },
  { path: '/office-hierarchy', label: 'Office Hierarchy', icon: GitBranch },
  { path: '/lookup', label: 'Backend Breakdown', icon: Database },
  { path: '/higher-view', label: 'Office Summary', icon: Eye },
  { path: '/exports', label: 'Email', icon: Mail },
  { path: '/audit', label: 'Audit Log', icon: ClipboardList },
  { path: '/processing-logs', label: 'Processing Logs', icon: Activity },
  { path: '/system-logic', label: 'System Logic', icon: FileCode },
  { path: '/data-dictionary', label: 'Data Dictionary', icon: BookOpen },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isUnlocked, isLocked, requestUnlock } = useAdminLock();

  const isMoreActive = moreItems.some(
    (item) => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around h-14">
        {primaryTabs.map((tab) => {
          const isActive = location.pathname === tab.path || (tab.path !== '/' && location.pathname.startsWith(tab.path));
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] transition-colors',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}
            >
              <tab.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                'flex flex-col items-center justify-center flex-1 gap-0.5 text-[10px] transition-colors',
                isMoreActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}
            >
              <MoreHorizontal className={cn('h-5 w-5', isMoreActive && 'text-primary')} />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <div className="grid grid-cols-3 gap-2 py-4">
              {moreItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const locked = isLocked(item.path) && !isUnlocked;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={(e) => {
                      if (locked) {
                        e.preventDefault();
                        requestUnlock(item.path);
                      }
                      setOpen(false);
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <div className="relative">
                      <item.icon className="h-5 w-5" />
                      {locked && <Lock className="h-2.5 w-2.5 absolute -top-1 -right-1 opacity-70" />}
                    </div>
                    <span className="text-center leading-tight">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
