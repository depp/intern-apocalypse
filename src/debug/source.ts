import { SourceError, SourceText } from '../lib/sourcepos';

/** Log a source error to the console. */
export function logSourceError(text: SourceText, e: SourceError) {
  const loc = text.lookup(e.sourceStart);
  let msg = '';
  if (loc != null) {
    msg += ':';
    msg += loc.lineno;
    msg += ':';
    msg += loc.colno;
  }
  msg += ' ';
  msg += e.message;
  console.error(msg);
}
