import { FOLIO_MARK_SVG } from '@/lib/design/folio.generated';
import { cn } from '@/lib/utils';

/**
 * The locked brand mark (folio/assets/mark.svg, verbatim) beside the Newsreader
 * wordmark. Color comes only from currentColor (DESIGN.md [D1-2.1], [D1-2.3]).
 */
export function Brand({
  symbolOnly = false,
  className,
}: {
  symbolOnly?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2 text-[1.5rem] text-[var(--ink)]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="lj-svg-fill inline-block h-[0.8em] w-[0.8em] shrink-0 text-[var(--accent)]"
        dangerouslySetInnerHTML={{ __html: FOLIO_MARK_SVG }}
      />
      <span
        className={
          symbolOnly
            ? 'sr-only'
            : 'font-serif font-medium leading-none tracking-tight'
        }
      >
        Linejam
      </span>
    </span>
  );
}
