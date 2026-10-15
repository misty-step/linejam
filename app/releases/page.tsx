// `/changelog` is the canonical release history; `/releases` stays a 200 alias
// for existing links and probes. Route segment config is read per file.
export { default, metadata } from '../changelog/page';

export const dynamic = 'force-static';
