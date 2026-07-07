'use client';

import { Printer } from 'lucide-react';
import { Button } from './ui/Button';
import { E2E_TEST_IDS } from '@/lib/e2eTestIds';
import { trackRecapExported } from '@/lib/analytics';

/**
 * Whole-set export for the public recap page (linejam-943 criteria 2 & 4).
 * Uses the browser's native print-to-PDF path against the print stylesheet
 * in app/globals.css rather than a bespoke PDF/image renderer — every poem
 * on the page, laid out with app/globals.css's print rules, one action.
 */
export function RecapExportButton({ poemCount }: { poemCount: number }) {
  const handleExport = () => {
    trackRecapExported({ method: 'print', poemCount });
    window.print();
  };

  return (
    <Button
      onClick={handleExport}
      data-testid={E2E_TEST_IDS.recapExportButton}
      variant="outline"
      size="lg"
      className="print:hidden h-14"
    >
      <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
      Export as PDF
    </Button>
  );
}
