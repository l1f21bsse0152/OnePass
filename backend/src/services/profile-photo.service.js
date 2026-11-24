import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const PROFILE_PHOTO_DIRECTORY = path.resolve(
  currentDirectory,
  "../../uploads/profiles"
);

export async function removeProfilePhotoFile(filename) {
  if (!filename) {
    return;
  }

  const safeFilename = path.basename(filename);

  if (safeFilename !== filename) {
    throw new Error("Invalid profile photo filename.");
  }

  try {
    await unlink(path.join(PROFILE_PHOTO_DIRECTORY, safeFilename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
