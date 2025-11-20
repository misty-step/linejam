'use client';

import { useUser } from '../../../lib/auth';
import { Button } from '../../../components/ui/Button';
import { SignInButton, SignOutButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

export default function ProfilePage() {
  const { clerkUser, guestId, displayName, isAuthenticated } = useUser();

  // Simple state for display purposes
  const currentName = displayName || '';

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-6 md:p-12 lg:p-24">
      <div className="max-w-xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex justify-between items-end border-b border-[var(--color-border)] pb-8">
          <h1 className="text-5xl font-[var(--font-display)]">Identity</h1>
          <Link
            href="/"
            className="text-sm font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors mb-2"
          >
            ← Home
          </Link>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 shadow-[var(--shadow-md)] space-y-8 relative overflow-hidden">
          {/* ID Card Header */}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                Current Alias
              </p>
              <p className="text-2xl font-[var(--font-display)] font-medium">
                {currentName || 'Anonymous Poet'}
              </p>
            </div>
            {isAuthenticated && clerkUser?.imageUrl && (
              <div className="w-16 h-16 border border-[var(--color-border)] p-1 bg-[var(--color-background)]">
                <Image
                  src={clerkUser.imageUrl}
                  alt="Profile"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all"
                />
              </div>
            )}
          </div>

          {/* Auth Section */}
          <div className="pt-8 border-t border-[var(--color-border-subtle)]">
            {isAuthenticated ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                    Account Status
                  </p>
                  <p className="font-medium text-[var(--color-success)]">
                    Authenticated
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 font-mono">
                    {clerkUser?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
                <SignOutButton>
                  <Button variant="secondary" className="w-full">
                    Sign Out
                  </Button>
                </SignOutButton>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                    Guest Credentials
                  </p>
                  <p className="font-mono text-sm text-[var(--color-text-secondary)] bg-[var(--color-muted)] p-2 border border-[var(--color-border-subtle)]">
                    ID: {guestId?.slice(0, 12)}...
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm italic text-[var(--color-text-muted)]">
                    Authenticate to preserve your works in the permanent
                    archives.
                  </p>
                  <SignInButton mode="modal">
                    <Button className="w-full">Authenticate</Button>
                  </SignInButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
