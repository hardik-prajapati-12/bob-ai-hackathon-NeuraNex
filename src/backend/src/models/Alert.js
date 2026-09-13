'use strict';

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: [
        'CONGESTION_RISK',
        'BERTH_CONFLICT',
        'CRANE_SHORTAGE',
        'VESSEL_DELAY',
        'BERTH_UNAVAILABLE',
        'CAPACITY_EXCEEDED',
        'SCHEDULE_CONFLICT',
        'MAINTENANCE_ALERT',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'HIGH', 'CRITICAL'],
      required: true,
    },
    // References
    terminalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Terminal',
      default: null,
    },
    terminalCode: {
      type: String,
      default: null,
    },
    vesselId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vessel',
      default: null,
    },
    vesselCode: {
      type: String,
      default: null,
    },
    berthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
    // Content
    message: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: null,
    },
    // Lifecycle
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

alertSchema.index({ terminalId: 1, acknowledged: 1 });
alertSchema.index({ severity: 1, acknowledged: 1 });
alertSchema.index({ type: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ vesselId: 1 });

module.exports = mongoose.model('Alert', alertSchema);
