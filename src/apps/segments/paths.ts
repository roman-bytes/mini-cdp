/** Where the saved segments live in the app. Every link to them is built here. */
export const SAVED_SEGMENTS_PATH = "/segments/saved";

export function segmentPath(segmentId: string): string {
  return `${SAVED_SEGMENTS_PATH}/${segmentId}`;
}

export function segmentExportPath(segmentId: string): string {
  return `${segmentPath(segmentId)}/export`;
}
