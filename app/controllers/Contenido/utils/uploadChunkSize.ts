// The TUS chunk size for every resumable media upload, shared so the browser
// uploader and the smoke test cannot drift apart. It used to live in both, kept
// in sync by a comment — which is not a mechanism.
const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024

export { UPLOAD_CHUNK_SIZE }
