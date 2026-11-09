
import mongoose from "mongoose";

const facilityQRSchema = new mongoose.Schema(
  {
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Facility",
      required: true,
      index: true
    },

    // Store only the SHA-256 hash, never the raw QR token.
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false
    },

    // Permanent QR codes have no expiration date.
    // This field is reserved for optional temporary QR codes.
    expiresAt: {
      type: Date,
      default: null
    },

    status: {
      type: String,
      enum: ["active", "expired", "revoked"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

// Find active QR codes belonging to a facility.
facilityQRSchema.index({
  facility: 1,
  status: 1,
  expiresAt: 1
});

const FacilityQR = mongoose.model("FacilityQR", facilityQRSchema);

export default FacilityQR;
