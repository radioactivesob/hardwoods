# Hardwoods

Read `DESIGN.md` before writing any code. It covers the privacy constraint that
shapes every feature, the pure-domain/storage-hook architecture, the conventions
that prevent bugs we've already shipped twice, and how to verify work when the
simulator can't be tapped.

## Expo HAS CHANGED

This project is on Expo SDK 56. Read the exact versioned docs at
https://docs.expo.dev/versions/v56.0.0/ rather than relying on recalled APIs —
`expo-file-system` in particular replaced its legacy API with `File`/`Directory`
classes.
