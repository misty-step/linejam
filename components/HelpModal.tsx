'use client';

import { EntryIsland } from './EntryIsland';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  return isOpen ? <EntryIsland kind="help" onClose={onClose} /> : null;
}

export function HelpContent({ onClose }: Pick<HelpModalProps, 'onClose'>) {
  return <EntryIsland kind="help-content" onClose={onClose} />;
}
