
import mongoose from "mongoose";

const facilityPackageSchema = new mongoose.Schema(
  {
    pointsCost: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    hoursIncluded: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    durationDays: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    }
  },
  { _id: false }
);

const operatingHoursSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true
    },
    open: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      required: true
    },
    close: {
      type: String,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      required: true
    },
    closed: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const holidayClosureSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ""
    }
  },
  { _id: false }
);

const facilitySchema = new mongoose.Schema(
  {
    // Directory listings are discoverable but do not support QR access.
    accessEnabled: {
      type: Boolean,
      default: true
    },

    isTestData: {
      type: Boolean,
      default: false
    },

    // Facility account responsible for managing this facility.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.accessEnabled !== false;
      },
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
      required: function () {
        return this.accessEnabled !== false;
      },
      validate: {
        validator: function (value) {
          if (this.accessEnabled === false) {
            return value === 0;
          }
          return Number.isSafeInteger(value) && value >= 1;
        },
        message:
          "Access-enabled facilities require positive whole-number points; directory listings use zero."
      }
    },

    pointsPerHour: {
      type: Number,
      required: function () {
        return this.accessEnabled !== false;
      },
      validate: {
        validator: function (value) {
          if (this.accessEnabled === false) {
            return value === undefined || value === 0;
          }
          return Number.isSafeInteger(value) && value >= 1;
        },
        message: "Access-enabled facilities require positive whole-number hourly points."
      }
    },

    packages: {
      weekly: {
        type: facilityPackageSchema,
        default: undefined
      },
      monthly: {
        type: facilityPackageSchema,
        default: undefined
      }
    },

    capacityLimit: {
      type: Number,
      min: 1,
      validate: Number.isSafeInteger,
      default: null
    },

    capacityRevision: {
      type: Number,
      default: 0
    },

    amenities: {
      type: [{ type: String, trim: true, maxlength: 40 }],
      default: []
    },

    photos: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: []
    },

    operatingHours: {
      type: [operatingHoursSchema],
      default: []
    },

    holidayClosures: {
      type: [holidayClosureSchema],
      default: []
    },

    timeZone: {
      type: String,
      trim: true,
      default: "UTC"
    },

    acceptedAccessMethods: {
      type: [{
        type: String,
        enum: ["wallet_points", "onepass_pass", "facility_package"]
      }],
      default: ["wallet_points", "onepass_pass", "facility_package"]
    },

    latitude: {
      type: Number,
      min: -90,
      max: 90
    },

    longitude: {
      type: Number,
      min: -180,
      max: 180
    },

    status: {
      type: String,
      enum: ["pending", "active", "suspended", "inactive"],
      default: "pending"
    },

    statusChangedAt: {
      type: Date,
      default: null
    },

    statusChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    statusChangeReason: {
      type: String,
      trim: true,
      maxlength: 250,
      default: ""
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
