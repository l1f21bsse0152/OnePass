import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const profilePhotoDirectory = path.resolve(
  currentDirectory,
  "../../uploads/profiles"
);
const allowedTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

mkdirSync(profilePhotoDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: profilePhotoDirectory,
    filename: (req, file, callback) => {
      callback(null, `${randomUUID()}${allowedTypes[file.mimetype]}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    if (!allowedTypes[file.mimetype]) {
      callback(new Error("Choose a JPEG, PNG, or WebP image."));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

export function profilePhotoUpload(req, res, next) {
  upload.single("photo")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

      res.status(status).json({
        success: false,
        message:
          status === 413
            ? "Profile photo must be 5 MB or smaller."
            : "Unable to process the profile photo upload."
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: error.message || "Choose a supported profile photo."
    });
  });
}
