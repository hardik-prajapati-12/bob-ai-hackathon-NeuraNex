'use strict';

const mongoose = require('mongoose');

const berthSchema = new mongoose.Schema(
  {
    berthId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    terminalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Terminal',
      required: true,
    },
    terminalCode: {
      type: String,
      required: true, // e.g. "T1" — denormalized for fast filtering
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Physical capacity
    maxVesselSizeTEU: {
      type: Number,
      required: true,
      min: 0,
    },
    maxVesselLengthM: {
      type: Number,
      default: 300,
    },
    maxDraftM: {
      type: Number,
      default: 15,
    },
    // Operational
    currentStatus: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'],
      default: 'AVAILABLE',
    },
    assignedVesselId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vessel',
      default: null,
    },
    availableFrom: {
      type: Date,
      default: null,
    },
    // Processing
    craneCount: {
      type: Number,
      default: 2,
      min: 0,
    },
    processingRateTEUPerHour: {
      type: Number,
      default: 300,
      min: 0,
    },
    // Utilization (updated by analytics engine)
    utilizationPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Metadata
    berthNumber: {
      type: Number,
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

berthSchema.index({ terminalId: 1, currentStatus: 1 });
berthSchema.index({ terminalCode: 1 });
berthSchema.index({ currentStatus: 1 });

module.exports = mongoose.model('Berth', berthSchema);
