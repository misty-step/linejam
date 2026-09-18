'use client';

import { useUser } from '../../../lib/auth';
import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import { Label } from '../../../components/ui/Label';
import { SignOutButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { getStableId } from '../../../lib/avatarColor';
import { useAccountState } from '@/lib/account';

export default function ProfilePage() {
  const { clerkUser, guestId, displayName, isAuthenticated } = useUser();
  const account = useAccountState();

  const currentName = displayName || '';
  const stableId = getStableId(clerkUser?.id, guestId);

  return (
    <div className="min-h-dvh bg-[var(--color-background)] px-4 py-8 sm:px-6 md:py-12">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <h1 className="text-3xl font-sans font-bold">Your profile</h1>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)]"
          >
            Home
          </Link>
        </div>

        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-5 sm:p-8 space-y-8">
          <div className="flex flex-wrap gap-4 justify-between items-start">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                stableId={stableId}
                displayName={currentName || 'Anonymous Poet'}
                size="lg"
              />
              <div className="min-w-0">
                <Label className="block mb-1">Your pen name</Label>
                <p className="break-words text-xl font-sans font-bold">
                  {currentName || 'Anonymous Poet'}
                </p>
              </div>
            </div>
            {isAuthenticated && clerkUser?.imageUrl && (
              <div className="w-12 h-12 overflow-hidden rounded-full bg-[var(--color-background)]">
                <Image
                  src={clerkUser.imageUrl}
                  alt="Profile"
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Auth Section */}
          <div className="pt-8 border-t border-[var(--color-border-subtle)]">
            {isAuthenticated ? (
              <div className="space-y-6">
                <div>
                  <Label className="block mb-1">Account</Label>
                  <p className="font-semibold text-[var(--color-success)]">
                    Signed in
                  </p>
                  <p className="break-words text-sm text-[var(--color-text-secondary)] mt-1">
                    {clerkUser?.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
                <SignOutButton>
                  <Button variant="secondary" className="w-full">
                    Sign out
                  </Button>
                </SignOutButton>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-[var(--color-text-secondary)]">
                  You&apos;re playing as a guest.
                </p>

                <div className="space-y-3">
                  {account.kind === 'local' ? (
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Accounts are not connected in this local game. Your poems
                      belong to this browser&apos;s guest session.
                    </p>
                  ) : (
                    <>
                      <p className="text-[var(--color-text-secondary)]">
                        Sign in to access your poems on other devices.
                      </p>
                      <Link
                        href="/sign-in"
                        className="inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3 font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)]"
                      >
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
