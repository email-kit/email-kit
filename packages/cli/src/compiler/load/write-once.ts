import { randomUUID } from "node:crypto"
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

/**
 * Writes a bundle named by its content hash, so a file that already exists is already right.
 * Otherwise it writes a temporary file and renames it into place, since another compile may be
 * importing the same bundle and must never see it half-written. If the rename fails because
 * Windows won't replace an open file, the file already there has the same content.
 */
export async function writeOnce(file: string, content: string): Promise<void> {
  if (await exists(file)) return
  await mkdir(dirname(file), { recursive: true })
  
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, content)
  
  try {
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true })
    if (!(await exists(file))) throw error
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}
