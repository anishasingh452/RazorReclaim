/**
 * Size of a batch when the caller doesn't specify one.
 *
 * Sized for a live demo rather than a load test: large enough that the
 * portfolio ranking, the decision mix and the approval queue all have
 * something to show, small enough that a run finishes while someone is
 * still watching it. Batches of 150 took long enough that the audience
 * stopped looking at the pipeline.
 */
export const DEFAULT_DEMO_CASE_COUNT = 28;
