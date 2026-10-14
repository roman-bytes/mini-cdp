/** The endpoint an open page polls to learn that a new app event has arrived. */
export const DELIVERY_MARKER_URL = "/api/mobile/v1/deliveries/marker";

/** The endpoint a person's open profile polls to learn they have new activity. */
export function personActivityMarkerUrl(personId: string): string {
  return `/api/people/v1/${personId}/activity-marker`;
}
