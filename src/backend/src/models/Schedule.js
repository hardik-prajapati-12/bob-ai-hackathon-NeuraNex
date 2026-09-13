'use strict';

const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    scheduleId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    vesselId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vessel',
      required: true,
    },
    vesselCode: {
      type: String,
      required: true, // denormalized for display
    },
    vesselName: {
      type: String,
    },
    terminalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Terminal',
      required: true,
    },
    terminalCode: {
      type: String,
      required: true,
    },
    berthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
    berthCode: {
      type: String,
      default: null,
    },
    // Timing
    plannedArrival: {
      type: Date,
      required: true,
    },
    plannedDeparture: {
      type: Date,
      required: true,
    },
    actualArrival: {
      type: Date,
      default: null,
    },
    actualDeparture: {
      type: Date,
      default: null,
    },
    estimatedArrival: {
      type: Date,
      default: null,
    },
    // Processing
    processingHoursEstimate: {
      type: Number,
      required: true,
      min: 0,
    },
    teuToProcess: {
      type: Number,
      default: 0,
    },
    craneAssignments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Crane',
      },
    ],
    requiredCranes: {
      type: Number,
      default: 2,
    },
    // Status
    status: {
      type: String,
      enum: ['SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DELAYED'],
      default: 'SCHEDULED',
    },
    // Delay tracking
    delayHours: {
      type: Number,
      default: 0,
    },
    delayReason: {
      type: String,
      default: null,
    },
    // Priority
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

scheduleSchema.index({ vesselId: 1 });
scheduleSchema.index({ terminalId: 1, plannedArrival: 1 });
scheduleSchema.index({ terminalCode: 1, plannedArrival: 1 });
scheduleSchema.index({ status: 1 });
scheduleSchema.index({ plannedArrival: 1 });
scheduleSchema.index({ berthId: 1, plannedArrival: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
