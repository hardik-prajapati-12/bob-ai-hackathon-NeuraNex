'use strict';

const mongoose = require('mongoose');

const terminalSchema = new mongoose.Schema(
  {
    terminalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    shortName: {
      type: String,
      trim: true,
    },
    location: {
      description: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },
    totalBerths: {
      type: Number,
      required: true,
      min: 1,
    },
    activeBerths: {
      type: Number,
      required: true,
      min: 0,
    },
    maxTEUCapacity: {
      type: Number,
      required: true,
      min: 0,
    },
    currentTEULoad: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCranes: {
      type: Number,
      default: 0,
      min: 0,
    },
    activeCranes: {
      type: Number,
      default: 0,
      min: 0,
    },
    operationalStatus: {
      type: String,
      enum: ['ACTIVE', 'REDUCED', 'MAINTENANCE', 'CLOSED'],
      default: 'ACTIVE',
    },
    // Operational characteristics
    avgProcessingRateTEUPerHour: {
      type: Number,
      default: 300,
    },
    maxVesselsSimultaneous: {
      type: Number,
      default: 6,
    },
    // Metadata
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Virtual: utilization percentage
terminalSchema.virtual('utilizationPercent').get(function () {
  if (!this.maxTEUCapacity) return 0;
  return Math.round((this.currentTEULoad / this.maxTEUCapacity) * 100);
});

terminalSchema.set('toJSON', { virtuals: true });
terminalSchema.set('toObject', { virtuals: true });

terminalSchema.index({ operationalStatus: 1 });

module.exports = mongoose.model('Terminal', terminalSchema);
