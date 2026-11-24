
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    phoneNumber: {
      type: String,
      trim: true,
      maxlength: 25,
      default: null
    },

    city: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null
    },

    country: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null
    },

    dateOfBirth: {
      type: Date,
      default: null
    },

    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
      default: null
    },

    emergencyContact: {
      name: {
        type: String,
        trim: true,
        maxlength: 80
      },
      phoneNumber: {
        type: String,
        trim: true,
        maxlength: 25
      },
      relationship: {
        type: String,
        trim: true,
        maxlength: 40
      }
    },

    profilePhotoFilename: {
      type: String,
      default: null
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    googleSub: {
      type: String,
      unique: true,
      sparse: true
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    role: {
      type: String,
      enum: ["traveler", "facility", "admin"],
      default: "traveler"
    },

    lastLoginDeviceType: {
      type: String,
      enum: ["mobile", "pc/laptop", "unknown"],
      default: "unknown"
    },

    failedLoginAttempts: {
      type: Number,
      default: 0
    },

    lockUntil: {
      type: Date,
      default: null
    },

    passwordChangedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
