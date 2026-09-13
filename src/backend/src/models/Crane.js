'use strict';

const mongoose = require('mongoose');

const craneSchema = new mongoose.Schema(
  {
    craneId: {
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
      required: true,
    },
    berthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['SHIP_TO_SHORE', 'RUBBER_TIRED_GANTRY', 'RAIL_MOUNTED_GANTRY', 'MOBILE_HARBOUR'],
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'],
      default: 'IDLE',
    },
    assignedVesselId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vessel',
      default: null,
    },
    // Capacity
    liftCapacityTEUPerHour: {
      type: Number,
      required: true,
      min: 1,
    },
    maxLiftWeightTonnes: {
      type: Number,
      default: 65,
    },
    // Utilization
    utilizationPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Metadata
    yearInstalled: {
      type: Number,
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

craneSchema.index({ terminalId: 1, status: 1 });
craneSchema.index({ terminalCode: 1 });
craneSchema.index({ status: 1 });

module.exports = mongoose.model('Crane', craneSchema);
