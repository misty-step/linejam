'use client';

import { useState } from 'react';
import { useUser } from '../../../lib/auth';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/Card';
import { SignInButton, SignOutButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';

export default function ProfilePage() {
  const { clerkUser, guestId, displayName, isAuthenticated } = useUser();
  const [name, setName] = useState('');

  // Sync name when displayName changes - using render-time update pattern
  if (displayName && name !== displayName) {
    setName(displayName);
  }

  // Ideally we would have a mutation to update the user's display name
  // For now, we just show the current state and allow auth actions.
  // Updating display name for guests is tricky without a specific mutation,
  // but we can assume they set it when joining/hosting.
  // Let's just show read-only for now or implement update later.

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle>Profile</CardTitle>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Home
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Display Name
            </label>
            <Input value={name} disabled />
            <p className="text-xs text-gray-500">
              Name is set when you join a game.
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100">
            {isAuthenticated ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {clerkUser?.imageUrl && (
                    <Image
                      src={clerkUser.imageUrl}
                      alt="Profile"
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{clerkUser?.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {clerkUser?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>
                <SignOutButton>
                  <Button variant="secondary" className="w-full">
                    Sign Out
                  </Button>
                </SignOutButton>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Sign in to save your poems and history across devices.
                </p>
                <SignInButton mode="modal">
                  <Button className="w-full">Sign In</Button>
                </SignInButton>
                <p className="text-xs text-gray-400 text-center">
                  Guest ID: {guestId?.slice(0, 8)}...
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
