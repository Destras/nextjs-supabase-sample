/**
 * Smoke test for the uncapped video/egregor upload path (ADR-0003).
 *
 * The jest suite proves `validateMediaFile` no longer rejects a large file, but
 * it does so against a File whose `size` was faked — it never touches Uppy,
 * TUS, Kong or the storage-api. This script closes that gap end to end: it
 * pushes a real multi-GB file through the same resumable endpoint, the same
 * chunk size and the same reconciliation the browser uses, then asserts the
 * stored object has the exact expected byte size.
 *
 * Usage:  npm run smoke:tus -- <path-to-video>
 */
import { createReadStream, statSync } from 'node:fs'
import { basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import * as tus from 'tus-js-client'
// Relative, not aliased: this runs under ts-node with scripts/tsconfig.json,
// whose `extends` does not carry the `@/*` path mapping.
import { UPLOAD_CHUNK_SIZE } from '../app/controllers/Contenido/utils/uploadChunkSize'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54521'
const ANON_KEY = process.env.SUPABASE_ANON_KEY
const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@clienteapp.test'
const PASSWORD = process.env.SMOKE_PASSWORD
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'contenidos'

const main = async (): Promise<void> => {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: npm run smoke:tus -- <path-to-video>')
    process.exit(1)
  }
  if (!PASSWORD) {
    console.error('SMOKE_PASSWORD is required')
    process.exit(1)
  }
  if (!ANON_KEY) {
    console.error('SUPABASE_ANON_KEY is required')
    process.exit(1)
  }

  const size = statSync(file).size
  const objectName = `egregores/smoke-${Date.now()}-${basename(file)}`

  console.log(`file        ${file}`)
  console.log(
    `size        ${size} bytes (${(size / 1024 ** 3).toFixed(2)} GiB)`,
  )
  console.log(`over 2 GiB  ${size > 2 * 1024 ** 3}`)
  console.log(`object      ${BUCKET}/${objectName}`)

  const supabase = createClient(SUPABASE_URL, ANON_KEY)
  const { data: auth, error: authError } =
    await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (authError || !auth.session) {
    console.error('auth failed:', authError?.message ?? 'no session')
    process.exit(1)
  }
  const token = auth.session.access_token
  console.log(`auth        ok (${EMAIL})`)

  const started = Date.now()
  let lastLogged = 0

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(createReadStream(file), {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      chunkSize: UPLOAD_CHUNK_SIZE,
      uploadSize: size,
      retryDelays: [0, 1000, 3000, 5000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'true' },
      metadata: { bucketName: BUCKET, objectName, contentType: 'video/mp4' },
      onError: reject,
      onProgress: (sent: number, total: number) => {
        const pct = Math.floor((sent / total) * 100)
        if (pct >= lastLogged + 10) {
          lastLogged = pct
          process.stdout.write(`\rupload      ${pct}%`)
        }
      },
      onSuccess: () => resolve(),
    })
    upload.start()
  })

  console.log(
    `\nupload      done in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  )

  // Reconcile exactly the way the hook does: list the folder and require the
  // stored byte size to match. A half-written object must not pass.
  const slash = objectName.lastIndexOf('/')
  const fileName = objectName.slice(slash + 1)
  const { data: listed, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(objectName.slice(0, slash), { search: fileName, limit: 100 })
  if (listError) {
    console.error('list failed:', listError.message)
    process.exit(1)
  }
  const match = listed?.find((entry) => entry.name === fileName)
  if (!match) {
    console.error('FAIL: object not found after upload')
    process.exit(1)
  }
  const stored = match.metadata?.size
  console.log(`stored      ${stored} bytes`)

  // Clean up before asserting, so a failure never leaves a multi-GB object
  // behind — and VERIFY it, because this step used to lie.
  //
  // The `contenidos` bucket has no DELETE policy at all (see
  // supabase/schemas/19_storage_policies.sql: SELECT/INSERT/UPDATE only, and
  // 27_storage_policies_imagenes.sql says so explicitly), so `remove()` as a
  // signed-in user is a silent no-op: it resolves without error and deletes
  // nothing. Every run used to leave a multi-GB object in the bucket while
  // printing "object removed". So the janitorial step alone uses the service
  // role when one is available, and we re-list to confirm rather than trust it.
  // The upload itself deliberately stays at ordinary-user privilege — the whole
  // point is to exercise the real admin storage policy.
  const janitor = SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : supabase
  await janitor.storage.from(BUCKET).remove([objectName])

  const { data: afterRemoval } = await janitor.storage
    .from(BUCKET)
    .list(objectName.slice(0, slash), { search: fileName, limit: 100 })
  const survived = afterRemoval?.some((entry) => entry.name === fileName)
  if (survived) {
    console.error(
      `cleanup     FAILED — ${BUCKET}/${objectName} is still there ` +
        `(${(size / 1024 ** 3).toFixed(2)} GiB). Delete it by hand` +
        (SERVICE_ROLE_KEY
          ? '.'
          : ', or re-run with SUPABASE_SERVICE_ROLE_KEY.'),
    )
  } else {
    console.log('cleanup     object removed (verified)')
  }

  if (stored !== size) {
    console.error(`FAIL: stored ${stored} != expected ${size}`)
    process.exit(1)
  }
  console.log('\nPASS — a >2 GiB video uploads through TUS and stores intact.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
