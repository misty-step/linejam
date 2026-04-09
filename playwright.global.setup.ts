import { clerkSetup } from '@clerk/testing/playwright';
import {
  hasClerkBrowserAuth,
  setClerkTestingEnv,
} from './tests/e2e/support/clerk';

export default async function globalSetup() {
  setClerkTestingEnv();

  if (!hasClerkBrowserAuth) {
    return;
  }

  await clerkSetup();
}
