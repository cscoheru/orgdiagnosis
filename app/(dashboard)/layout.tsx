import { ReactNode } from 'react';
import DashboardShell from './DashboardShell';

// Prevent Vercel from statically prerendering dashboard pages.
// All dashboard pages are authenticated and dynamic — prerendering
// causes "window is not defined" errors from client-only deps (recharts, reactflow, etc.)
export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
