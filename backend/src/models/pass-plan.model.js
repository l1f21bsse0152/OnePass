import mongoose from "mongoose";

const passPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },

    duration: {
      type: String,
      enum: ["weekly", "monthly"],
      required: true
    },

    durationDays: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    includedPoints: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger
    },

    bonusPoints: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger
    },

    active: {
      type: Boolean,
      default: true
    },

    demoOnly: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

passPlanSchema.index({ active: 1, duration: 1, includedPoints: 1 });

const PassPlan = mongoose.model("PassPlan", passPlanSchema);

export default PassPlan;
