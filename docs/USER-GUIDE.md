# Field and project user guide

## First project

Sign in via your emailed link. Create an organisation in Administration, then a project with chainage bounds. In Chainage Timeline, import a GeoJSON `LineString` or a GeoJSON Feature containing one. Coordinates must be longitude/latitude in WGS84. Set alignment bounds inside project bounds.

Calibration is optional. Without it, GPS remains a separate point and chainage is entered manually. Calibration segments specify geometric distance start/end and chainage start/end. Enter a separate segment after a station equation. Never infer surveyed chainage from a sample line.

## Record a finding

Choose New issue. Enter a title, alignment, category, severity and chainage (`CH 3+450`, `3+450` and `3450` are equivalent). An end chainage records an extent. Add a signed lateral offset in metres if known. Capture GPS to retain coordinates and accuracy; a calibrated estimate is labelled as an estimate. Verify it against site control.

You can also click empty space on the Interactive Map to start a record with manually selected coordinates. GPS-enabled device capture requires HTTPS (localhost is allowed for development) and device permission.

Attach a supported photo or PDF. A saved issue and a saved file are separate confirmations: if upload fails, reopen the issue to retry. Files remain quarantined until the scanning process clears them. A quarantine status is not a successful review.

## Progress work

Select a row, map marker or chainage marker to open the same issue detail. Managers/admins can assign project members. Follow Open → Assigned/In Progress → Ready for Review → Closed. Add comments, resolution notes and corrective actions. Complete all actions and provide clean evidence before asking an inspector/manager/admin to close the issue. Reopening requires a reviewer role and a reason of at least five characters.

A version conflict means someone else changed the issue. Close the dialog, refresh the workspace and reapply your intended change after reviewing the new record. The app will not silently overwrite it.

## Inspections and reports

Record a checklist result with pass/fail/not applicable, a note, due date and optional issue link. Another inspector/manager/admin can approve or request changes. Failed results should have a linked issue for follow-up.

The register, timeline and map share project/severity/status/category/chainage/date filters. Reports export CSV or PDF. Audit reports use project/date filters; issue reports also use category, severity, status and start-chainage bounds. The search text only filters the on-screen list. Narrow very large exports; exports deliberately reject the 5,000-row limit rather than silently claiming completeness. UI views currently load up to 1,000 records.

## Offline drafting

With the app already open, a new issue without attachments can be saved while offline. The UI says it is a local draft, not synchronised. Reconnect, open Administration and choose Synchronise drafts. Each draft has a stable UUID, so retrying a confirmed request cannot create a duplicate. Errors remain visible and drafts stay local until a server confirmation.

This version does not cache the whole application for cold offline startup, queue photo uploads or support offline edits. Photos must be uploaded after syncing the issue. Drafts persist after sign-out and are visible only to the same signed-in account in the UI, but the browser database is not encrypted. Use a trusted device and clear sensitive drafts before returning a shared device.
