import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Upload, Calculator, Banknote, Users, UserCheck, Building2, Mail, ClipboardList, Settings, ChevronLeft, BookOpen, FileCode, Activity, Eye, DollarSign, GitBranch, Lock, LockOpen, Table2 } from 'lucide-react';
import { useState } from 'react';
import hvLogo from '@/assets/hv-logo.png';
import kjLogo from '@/assets/kj-logo.png';
import { useAdminLock } from '@/hooks/useAdminLock';

const navSections = [
  { label: 'Operations', items: [
    { path: '/upload', label: 'Upload Center', icon: Upload },
    { path: '/payroll', label: 'Payroll Processing', icon: Calculator },
    { path: '/backend', label: 'Backend Money', icon: DollarSign },
  ]},
  { label: 'Data Management', items: [
    { path: '/advances', label: 'Advances', icon: Banknote },
    { path: '/clients', label: 'Clients', icon: Users },
    { path: '/fee-intercept', label: 'Fee Intercept', icon: DollarSign },
  ]},
  { label: 'Configurations', items: [
    { path: '/preparers', label: 'Master PTIN (Preparers)', icon: UserCheck },
    { path: '/offices', label: 'Master PTIN (Office)', icon: Building2 },
    { path: '/preparers-sheet', label: 'Master PTIN (Sheet View)', icon: Table2 },
    { path: '/office-hierarchy', label: 'Office Hierarchy', icon: GitBranch },
  ]},
  { label: 'Reporting', items: [
    { path: '/higher-view', label: 'Office Summary', icon: Eye },
    { path: '/exports', label: 'Email', icon: Mail },
  ]},
  { label: 'System', items: [
    { path: '/audit', label: 'Audit Log', icon: ClipboardList },
    { path: '/processing-logs', label: 'Processing Logs', icon: Activity },
    { path: '/system-logic', label: 'System Logic', icon: FileCode },
    { path: '/data-dictionary', label: 'Data Dictionary', icon: BookOpen },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]},
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const currentUser = localStorage.getItem('hvt_user');
  const isKingJ = currentUser === 'King J';
  const { isUnlocked, isLocked, requestUnlock } = useAdminLock();

  const logo = isKingJ ? kjLogo : hvLogo;
  const brandName = isKingJ ? 'King J Income Tax' : 'Higher View Taxes';
  const brandSub = isKingJ ? 'Tax Services' : 'Payroll Platform';

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full z-30 flex-col transition-all duration-200 border-r',
      isKingJ ? 'bg-[hsl(140_10%_6%)] border-[hsl(130_20%_16%)]' : 'bg-sidebar border-sidebar-border',
      'hidden lg:flex',
      collapsed ? 'w-16' : 'w-[260px]',
    )}>
      <div className={cn(
        'h-16 flex items-center px-4 border-b shrink-0',
        isKingJ ? 'border-[hsl(130_20%_16%)]' : 'border-sidebar-border',
        collapsed && 'justify-center'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img src={logo} alt={brandName} className="h-8 w-8 rounded-lg object-contain shrink-0" />
            <div className="min-w-0">
              <span className={cn('text-sm font-semibold truncate block', isKingJ ? 'text-[hsl(45_80%_60%)]' : 'text-sidebar-accent-foreground')}>{brandName}</span>
              <span className={cn('block text-[10px]', isKingJ ? 'text-[hsl(130_30%_45%)]' : 'text-sidebar-muted')}>{brandSub}</span>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={logo} alt={brandName} className="h-8 w-8 rounded-lg object-contain" />
        )}
      </div>
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label} className="mb-1">
            {!collapsed && (
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider px-3 py-2', isKingJ ? 'text-[hsl(130_20%_40%)]' : 'text-sidebar-muted')}>
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                const locked = isLocked(item.path) && !isUnlocked;
                return (
                  <NavLink key={item.path} to={item.path} onClick={(e) => {
                    if (locked) {
                      e.preventDefault();
                      requestUnlock(item.path);
                    }
                  }} className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isKingJ
                      ? isActive
                        ? 'bg-[hsl(130_30%_12%)] text-[hsl(45_80%_60%)] font-medium'
                        : 'text-[hsl(130_20%_65%)] hover:bg-[hsl(130_20%_10%)] hover:text-[hsl(45_80%_60%)]'
                      : isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  )}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="text-[13px] flex-1">{item.label}</span>}
                    {!collapsed && isLocked(item.path) && (
                      locked
                        ? <Lock className="h-3 w-3 shrink-0 opacity-60" />
                        : <LockOpen className="h-3 w-3 shrink-0 opacity-40" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <button onClick={() => setCollapsed(!collapsed)} className={cn(
        'h-10 items-center justify-center border-t transition-colors hidden lg:flex',
        isKingJ ? 'border-[hsl(130_20%_16%)] text-[hsl(130_20%_40%)] hover:text-[hsl(45_80%_60%)]' : 'border-sidebar-border text-sidebar-muted hover:text-sidebar-accent-foreground'
      )}>
        <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
      </button>
    </aside>
  );
}