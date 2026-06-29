// Orientation is controlled via Info.plist (all orientations declared).
// Game screens use a landscape-only layout naturally.
// Setup screens allow free rotation via the OS.
// No native module needed — the plist + layout design handles it.

export function useLandscapeOnly() {}
export function useAllOrientations() {}
