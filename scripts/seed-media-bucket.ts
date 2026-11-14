/**
 * Upload every binary in ./media to the Supabase "contenidos" bucket.
 *
 * Usage:
 *   npm run seed:media
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local (loaded manually — no dotenv dep). Uploads with upsert,
 * so re-running the script is safe.
 *
 * SUPABASE_SERVICE_ROLE_KEY holds either the legacy service_role JWT or the
 * new secret key (sb_secret_...). It must NOT be the publishable key: that one
 * replaced the anon key, does not bypass RLS, and the
 * admin_insert_contenidos_storage policy will reject every upload.
 *
 * The ./media folder is gitignored; binaries live outside the repo.
 * For a fresh local setup, drop the placeholder files into ./media and
 * run this script after `supabase db reset`.
 */

import { createClient } from '@supabase/supabase-js'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const BUCKET = 'contenidos'
const MEDIA_DIR = join(process.cwd(), 'media')

const MIME_BY_EXT: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}

const FOLDER_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'audios',
  'video/mp4': 'videos',
  'application/pdf': 'textos',
  'text/plain': 'textos',
}

async function loadDotenvLocal(): Promise<void> {
  let raw: string
  try {
    raw = await readFile('.env.local', 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
    throw err
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(
      `Missing ${name}. Set it in .env.local or export it before running.`,
    )
    process.exit(1)
  }
  return value
}

async function main(): Promise<void> {
  await loadDotenvLocal()

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let entries
  try {
    entries = await readdir(MEDIA_DIR, { withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(
        `No ${MEDIA_DIR} folder found. Place the placeholder binaries there and re-run.`,
      )
      process.exit(1)
    }
    throw err
  }

  const files = entries.filter((e) => e.isFile()).map((e) => e.name)
  if (files.length === 0) {
    console.error(`${MEDIA_DIR} is empty — nothing to upload.`)
    process.exit(1)
  }

  console.log(
    `Uploading ${files.length} files from ${MEDIA_DIR} to bucket "${BUCKET}"...`,
  )

  let uploaded = 0
  let skipped = 0
  for (const filename of files) {
    const ext = extname(filename).toLowerCase()
    const mime = MIME_BY_EXT[ext]
    if (!mime) {
      console.warn(`  skip ${filename}: unsupported extension ${ext}`)
      skipped++
      continue
    }
    const folder = FOLDER_BY_MIME[mime]
    const objectPath = `${folder}/${filename}`
    const buffer = await readFile(join(MEDIA_DIR, filename))
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType: mime,
        upsert: true,
      })
    if (error) {
      console.error(`  fail ${filename}: ${error.message}`)
      process.exit(1)
    }
    const sizeMib = (buffer.byteLength / 1024 / 1024).toFixed(1)
    console.log(`  ok   ${objectPath} (${sizeMib} MiB)`)
    uploaded++
  }

  console.log(`Done — uploaded ${uploaded}, skipped ${skipped}.`)
}

void main()
