'use strict';

const mongoose = require('mongoose');

const historicalOperationSchema = new mongoose.Schema(
  {
    // Date of the operational record (day-level granularity)
    date: {
      type: Date,
      required: true,
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
    // Vessel metrics
    vesselCount: {
      type: Number,
      default: 0,
    },
    vesselArrivals: {
      type: Number,
      default: 0,
    },
    vesselDepartures: {
      type: Number,
      default: 0,
    },
    largeVesselCount: {
      type: Number,
      default: 0,
      // vessels >= 8000 TEU
    },
    // Waiting & processing
    avgWaitingHours: {
      type: Number,
      default: 0,
    },
    maxWaitingHours: {
      type: Number,
      default: 0,
    },
    totalProcessingHours: {
      type: Number,
      default: 0,
    },
    // Utilization
    avgBerthUtilizationPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    peakBerthUtilizationPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    avgCraneUtilizationPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Throughput
    totalTEUProcessed: {
      type: Number,
      default: 0,
    },
    // Congestion events
    congestionEvents: {
      type: Number,
      default: 0,
    },
    congestionLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'NONE'],
      default: 'NONE',
    },
    // Peak hour (0-23)
    peakArrivalHour: {
      type: Number,
      default: null,
      min: 0,
      max: 23,
    },
    // Weather/operational disruptions
    operationalDisruption: {
      type: Boolean,
      default: false,
    },
    disruptionNote: {
      type: String,
      default: null,
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound unique: one record per terminal per day
historicalOperationSchema.index({ terminalId: 1, date: 1 }, { unique: true });
historicalOperationSchema.index({ terminalCode: 1, date: -1 });
historicalOperationSchema.index({ date: -1 });
historicalOperationSchema.index({ congestionLevel: 1 });

module.exports = mongoose.model('HistoricalOperation', historicalOperationSchema);
