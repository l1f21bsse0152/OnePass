import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "./config/db.js";
import User from "./models/user.model.js";
import Facility from "./models/facility.model.js";
import FacilityQR from "./models/facility-qr.model.js";
import PassPlan from "./models/pass-plan.model.js";
import { generateFacilityQR } from "./services/facility-qr.service.js";

// Safety gate: Prohibit running seed outside development environment
if (process.env.NODE_ENV !== "development") {
  console.error("Error: Seeding is permitted ONLY when NODE_ENV=development.");
  process.exit(1);
}

const SAMPLE_FACILITIES = [
  {
    name: "OnePass Test Gym",
    category: "gym",
    city: "Lahore",
    address: "Johar Town, Lahore",
    description: "Test-only facility record; excluded from user-facing APIs.",
    pointsPerVisit: 50,
    pointsPerHour: 50,
    packages: {
      weekly: { pointsCost: 400, hoursIncluded: 10, durationDays: 7 },
      monthly: { pointsCost: 1500, hoursIncluded: 40, durationDays: 30 }
    },
    isTestData: true,
    status: "active"
  },
  {
    name: "Pulse Fitness Club",
    category: "fitness",
    city: "Lahore",
    address: "MM Alam Road, Gulberg III, Lahore",
    description: "Premium fitness facility with modern strength and cardio equipment.",
    pointsPerVisit: 150,
    pointsPerHour: 150,
    packages: {
      weekly: { pointsCost: 1200, hoursIncluded: 10, durationDays: 7 },
      monthly: { pointsCost: 4500, hoursIncluded: 40, durationDays: 30 }
    },
    status: "active"
  },
  {
    name: "Dawoor Coworking Space",
    category: "workspaces",
    city: "Lahore",
    address: "Sector Y, Phase 3, DHA, Lahore",
    description: "High-speed flexible workspaces, meeting rooms, and quiet zones.",
    pointsPerVisit: 100,
    pointsPerHour: 100,
    packages: {
      weekly: { pointsCost: 800, hoursIncluded: 10, durationDays: 7 },
      monthly: { pointsCost: 3000, hoursIncluded: 40, durationDays: 30 }
    },
    status: "active"
  },
  {
    name: "Zenith Wellness Lounge",
    category: "lifestyle",
    city: "Lahore",
    address: "Commercial Area, Phase 5, DHA, Lahore",
    description: "Relaxation and wellness facility offering lifestyle rejuvenation services.",
    pointsPerVisit: 120,
    pointsPerHour: 120,
    packages: {
      weekly: { pointsCost: 960, hoursIncluded: 10, durationDays: 7 },
      monthly: { pointsCost: 3600, hoursIncluded: 40, durationDays: 30 }
    },
    status: "active"
  },
  {
    name: "Iron Matrix Gym",
    category: "fitness",
    city: "Lahore",
    address: "Model Town Link Road, Lahore",
    description: "Strength training, powerlifting, and athletic performance center.",
    pointsPerVisit: 180,
    pointsPerHour: 180,
    packages: {
      weekly: { pointsCost: 1440, hoursIncluded: 10, durationDays: 7 },
      monthly: { pointsCost: 5400, hoursIncluded: 40, durationDays: 30 }
    },
    status: "active"
  },
  {
    name: "Momentum Fitness Lahore",
    category: "fitness",
    city: "Lahore",
    address: "287 H2, Emporium Mall Road, Johar Town, Lahore",
    description: "Fitness centre listed near Emporium Mall Road in Johar Town.",
    accessEnabled: false,
    pointsPerVisit: 0,
    latitude: 31.4681568,
    longitude: 74.2647971,
    status: "active"
  },
  {
    name: "Matrix Health & Fitness",
    category: "fitness",
    city: "Lahore",
    address: "72-77, Model Town Circular Road, F Block, Model Town, Lahore",
    description: "Health and fitness centre on Model Town Circular Road.",
    accessEnabled: false,
    pointsPerVisit: 0,
    latitude: 31.4886819,
    longitude: 74.3253741,
    status: "active"
  },
  {
    name: "Quaid-e-Azam Library",
    category: "libraries",
    city: "Lahore",
    address: "Mall Road, Regal Chowk, Lahore",
    description: "Public library in Bagh-e-Jinnah along Mall Road.",
    accessEnabled: false,
    pointsPerVisit: 0,
    latitude: 31.5545645,
    longitude: 74.3317492,
    status: "active"
  },
  {
    name: "Punjab Public Library",
    category: "libraries",
    city: "Lahore",
    address: "Wazir Khan Baradari Lane, Anarkali, Lahore",
    description: "Public library near Anarkali on Wazir Khan Baradari Lane.",
    accessEnabled: false,
    pointsPerVisit: 0,
    latitude: 31.5673995,
    longitude: 74.3076127,
    status: "active"
  },
  {
    name: "Bagh-e-Jinnah Library",
    category: "libraries",
    city: "Lahore",
    address: "Racecourse Road, Lahore",
    description: "Library in Bagh-e-Jinnah on Racecourse Road.",
    accessEnabled: false,
    pointsPerVisit: 0,
    latitude: 31.5523964,
    longitude: 74.3288503,
    status: "active"
  },
  {
    name: "Joyland Limited",
    category: "lifestyle",
    city: "Lahore",
    address: "10, Fortress Stadium, Lahore Cantt",
    description: "Entertainment venue listed at Fortress Stadium in Lahore Cantt.",
    accessEnabled: false,
    pointsPerVisit: 0,
    latitude: 31.5328836,
    longitude: 74.364082,
    status: "active"
  }
];

const UNIVERSAL_PASS_PLANS = [
  { duration: "weekly", durationDays: 7, includedPoints: 3000 },
  { duration: "weekly", durationDays: 7, includedPoints: 4000 },
  { duration: "weekly", durationDays: 7, includedPoints: 5000 },
  { duration: "monthly", durationDays: 30, includedPoints: 10000 },
  { duration: "monthly", durationDays: 30, includedPoints: 15000 },
  { duration: "monthly", durationDays: 30, includedPoints: 20000 }
].map((plan) => ({
  ...plan,
  code: `onepass-${plan.duration}-${plan.includedPoints}`,
  name: `${plan.duration === "weekly" ? "Weekly" : "Monthly"} ${plan.includedPoints.toLocaleString()} points`,
  bonusPoints: Math.floor(plan.includedPoints * 0.1),
  active: true,
  demoOnly: true
}));

const seedDatabase = async () => {
  try {
    console.log("Connecting to MongoDB for seeding...");
    await connectDB();

    // 1. Upsert demo facility manager user
    const ownerEmail = "demo.facility@example.test";
    let owner = await User.findOne({ email: ownerEmail });

    if (!owner) {
      const demoPassword = process.env.DEMO_FACILITY_PASSWORD;
      if (!demoPassword) {
        throw new Error(
          "Set DEMO_FACILITY_PASSWORD in the local environment to create the demo facility account."
        );
      }

      const passwordHash = await bcrypt.hash(demoPassword, 12);
      owner = await User.create({
        fullName: "OnePass Facility Manager",
        email: ownerEmail,
        password: passwordHash,
        role: "facility",
        isEmailVerified: true
      });
      console.log(`Created facility manager account: ${ownerEmail}`);
    } else {
      console.log(`Facility manager account already exists: ${ownerEmail}`);
    }

    const seededResults = [];

    // 2. Upsert facilities and generate active QR codes
    for (const item of SAMPLE_FACILITIES) {
      let facility = await Facility.findOne({
        name: item.name,
        city: item.city
      });

      if (!facility) {
        const facilityData = { ...item };
        if (item.accessEnabled !== false) {
          facilityData.owner = owner._id;
        }
        facility = await Facility.create({
          ...facilityData,
          accessEnabled: item.accessEnabled !== false
        });
        console.log(`Created facility: ${facility.name}`);
      } else {
        facility.status = "active";
        facility.accessEnabled = item.accessEnabled !== false;
        facility.isTestData = item.isTestData === true;
        facility.pointsPerVisit = item.pointsPerVisit;
        facility.pointsPerHour = item.pointsPerHour;
        facility.packages = item.packages;
        facility.address = item.address;
        facility.description = item.description;
        facility.latitude = item.latitude;
        facility.longitude = item.longitude;
        if (!facility.accessEnabled) {
          facility.owner = undefined;
        } else if (!item.isTestData || !facility.owner) {
          facility.owner = owner._id;
        }
        await facility.save();
        console.log(`Updated existing facility: ${facility.name}`);
      }

      let rawToken = null;
      if (facility.isTestData) {
        rawToken = "Test data only; not publicly accessible";
      } else if (facility.accessEnabled === false) {
        await FacilityQR.updateMany(
          { facility: facility._id, status: "active" },
          { $set: { status: "revoked" } }
        );
        rawToken = "Not available for directory listings";
      } else {
        const activeQR = await FacilityQR.findOne({
          facility: facility._id,
          status: "active"
        });

        if (!activeQR) {
          const qrResult = await generateFacilityQR({
            facilityId: facility._id,
            ownerId: owner._id
          });
          rawToken = qrResult.token;
          console.log(`Generated new permanent QR for: ${facility.name}`);
        } else {
          rawToken = "[Existing QR Active - SHA-256 protected]";
        }
      }

      seededResults.push({
        id: facility._id.toString(),
        name: facility.name,
        category: facility.category,
        city: facility.city,
        points: facility.accessEnabled
          ? `${facility.pointsPerVisit} PTS`
          : "Directory listing",
        qrToken: rawToken
      });
    }

    for (const plan of UNIVERSAL_PASS_PLANS) {
      await PassPlan.updateOne(
        { code: plan.code },
        { $set: plan },
        { upsert: true, runValidators: true }
      );
    }

    console.log("\n=======================================================");
    console.log("ONEPASS MVP DATABASE SEEDING COMPLETED SUCCESSFULLY");
    console.log("=======================================================\n");
    console.table(seededResults);
    console.log(
      "\nOnly OnePass-enabled facilities have QR tokens; directory listings are map-only.\n"
    );

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);

  } catch (error) {
    console.error("Seeding failed with error:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();
