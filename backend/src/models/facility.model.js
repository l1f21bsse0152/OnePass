
import mongoose from "mongoose";

const facilitySchema = new mongoose.Schema(
  {
    // Facility account responsible for managing this facility.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },

    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },

    city: {
      type: String,
      required: true,
      trim: true
    },

    // Fixed points charged for one successful visit.
    pointsPerVisit: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Points per visit must be a positive whole number."
      }
    },

    status: {
      type: String,
      enum: ["pending", "active", "suspended", "inactive"],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

// Helps retrieve facilities belonging to an owner by status.
facilitySchema.index({
  owner: 1,
  status: 1
});

// Helps discover active facilities by city and category.
facilitySchema.index({
  city: 1,
  category: 1,
  status: 1
});

const Facility = mongoose.model("Facility", facilitySchema);

export default Facility;
