import { Redirect } from 'expo-router';

/**
 * iOS hands the app a file:// URL when someone opens a .hardwoods file from
 * AirDrop, Messages or Files. expo-router sees that URL too, can't match it
 * as a path, and would otherwise push its built-in "Unmatched Route" screen
 * onto the stack — invisible at the time, because the importer lands on top
 * of it, but the thing you hit on the way back out.
 *
 * The import itself is handled in _layout's useIncomingFiles, which listens
 * to Linking directly. This screen exists purely so the unmatched URL leaves
 * nothing behind: replace it with home, and back from the importer goes where
 * it should. Any other unmatched route lands somewhere useful too.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
