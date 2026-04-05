/**
 * Publishes the technical review packet to HackMD as a publicly viewable,
 * commentable note. Run with: npx tsx scripts/publish-to-hackmd.ts
 */
import HackMDAPI from '@hackmd/api'

// The enums may not be re-exported at top level, use string literals
const API = HackMDAPI
import { readFileSync } from 'fs'
import { resolve } from 'path'

const HACKMD_TOKEN = process.env.HACKMD_API_KEY?.replace(/"/g, '') || ''

if (!HACKMD_TOKEN) {
  console.error('Missing HACKMD_API_KEY in environment')
  process.exit(1)
}

const client = new API(HACKMD_TOKEN)

async function main() {
  // Verify auth
  const me = await client.getMe()
  console.log(`Authenticated as: ${me.name} (${me.email})`)

  // Read the combined review document
  const content = readFileSync(
    resolve(__dirname, '../docs/HACKMD-REVIEW.md'),
    'utf-8'
  )

  // Create the note - readable by anyone (guest), writable only by owner,
  // comments open to everyone
  const note = await client.createNote({
    title: 'boredgame.lol - Technical Review Packet',
    content,
    readPermission: 'guest' as any,
    writePermission: 'owner' as any,
    commentPermission: 'everyone' as any,
  })

  console.log('\n--- Published! ---')
  console.log(`Note ID: ${note.id}`)
  console.log(`Short ID: ${note.shortId}`)
  console.log(`\nShare this link with your reviewers:`)
  console.log(`  https://hackmd.io/${note.shortId}`)
  console.log(`\nEdit link (only you):`)
  console.log(`  https://hackmd.io/${note.shortId}?edit`)
  console.log(`\nTo update later, run this script again with --update ${note.id}`)
}

// Support updating an existing note
async function update(noteId: string) {
  const content = readFileSync(
    resolve(__dirname, '../docs/HACKMD-REVIEW.md'),
    'utf-8'
  )

  await client.updateNote(noteId, {
    content,
    readPermission: 'guest' as any,
    writePermission: 'owner' as any,
  })

  console.log(`Updated note ${noteId}`)
  console.log(`Link: https://hackmd.io/${noteId}`)
}

const args = process.argv.slice(2)
if (args[0] === '--update' && args[1]) {
  update(args[1]).catch(console.error)
} else {
  main().catch(console.error)
}
