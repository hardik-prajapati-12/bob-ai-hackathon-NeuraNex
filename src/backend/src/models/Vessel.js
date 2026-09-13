'use strict';

const mongoose = require('mongoose');

const vesselSchema = new mongoose.Schema(
  {
    vesselId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    vesselName: {
      type: String,
      required: true,
      trim: true,
    },
    imoNumber: {
      type: String,
      trim: true,
      // IMO-style demo identifier, e.g. "IMO9876543"
    },
    // Classification
    vesselType: {
      type: String,
      enum: ['CONTAINER', 'BULK', 'TANKER', 'FEEDER', 'RORO'],
      required: true,
    },
    sizeTEU: {
      type: Number,
      required: true,
      min: 0,
    },
    lengthOverallM: {
      type: Number,
      default: null,
    },
    maxDraftM: {
      type: Number,
      default: null,
    },
    // Identity
    flag: {
      type: String,
      default: 'SG',
    },
    shippingLine: {
      type: String,
      trim: true,
    },
    // Scheduling
    arrivalTime: {
      type: Date,
      required: true,
    },
    estimatedDeparture: {
      type: Date,
      default: null,
    },
    actualArrival: {
      type: Date,
      default: null,
    },
    actualDeparture: {
      type: Date,
      default: null,
    },
    // Assignment
    terminalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Terminal',
      default: null,
    },
    terminalCode: {
      type: String,
      default: null,
    },
    assignedBerthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
    // Operational status
    status: {
      type: String,
      enum: ['INBOUND', 'AT_BERTH', 'WAITING', 'DEPARTED', 'DELAYED', 'DIVERTED'],
      default: 'INBOUND',
    },
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    cargoType: {
      type: String,
      enum: ['IMPORT', 'EXPORT', 'TRANSHIPMENT', 'MIXED'],
      default: 'MIXED',
    },
    // Congestion / waiting
    waitingHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedProcessingHours: {
      type: Number,
      default: 0,
    },
    congestionRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
    },
    congestionRiskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    // Crane requirements
    requiredCranes: {
      type: Number,
      default: 2,
      min: 1,
    },
    assignedCraneIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Crane',
      },
    ],
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Virtual: is large vessel (>= 8000 TEU)
vesselSchema.virtual('isLargeVessel').get(function () {
  return this.sizeTEU >= 8000;
});

vesselSchema.set('toJSON', { virtuals: true });
vesselSchema.set('toObject', { virtuals: true });

vesselSchema.index({ terminalId: 1, status: 1 });
vesselSchema.index({ terminalCode: 1, status: 1 });
vesselSchema.index({ arrivalTime: 1 });
vesselSchema.index({ congestionRisk: 1 });
vesselSchema.index({ status: 1 });

module.exports = mongoose.model('Vessel', vesselSchema);
