import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const location = useLocation();
  const user = typeof window !== 'undefined' ? localStorage.getItem('hvt_user') : null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return (
    <div className="min-h-[100dvh] bg-surface-ash">
      <AppSidebar />
      <div className={cn('transition-all duration-200 lg:ml-[260px]')}>
        <AppHeader />
        <main className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
