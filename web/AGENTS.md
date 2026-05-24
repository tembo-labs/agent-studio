<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions

## Render dates with `<LocalTime>`, never raw `toLocaleString` in server code

The web container runs in UTC, so any server-side `new Date(...).toLocaleString()` (in a server component, page, or layout) emits **UTC** text — not the user's local time. Always render dates through `@/components/local-time`:

```tsx
import { LocalTime } from "@/components/local-time";

<LocalTime iso={someIsoString} />
```

`LocalTime` is a small client component that waits until mount and then formats with `Intl.DateTimeFormat` using the browser's tz. Render nothing inline-of-server before mount to avoid a flash of UTC.

Helper functions that compute *relative* time (e.g. `"13ms after queued"`) or *durations* (e.g. `"1.7s"`) are tz-agnostic and can stay inline — they take two ISO strings and return a difference. Only the absolute display of a wall-clock instant needs `LocalTime`.
