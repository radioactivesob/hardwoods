# Hardwoods

Read `DESIGN.md` before writing any code. It covers the privacy constraint that
shapes every feature, the pure-domain/storage-hook architecture, the conventions
that prevent bugs we've already shipped twice, and how to verify on the
simulator. Then read `ROADMAP.md` for what's next and the principles behind it.

## Expo HAS CHANGED

This project is on Expo SDK 57. Read the exact versioned docs at
https://docs.expo.dev/versions/v57.0.0/ rather than relying on recalled APIs —
`expo-file-system` in particular replaced its legacy API with `File`/`Directory`
classes.
