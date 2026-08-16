import type { ReactNode } from 'react';

import { AuthLayout } from './AuthLayout';

export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
