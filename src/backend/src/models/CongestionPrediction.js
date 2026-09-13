'use strict';

const mongoose = require('mongoose');

const contributingFactorSchema = new mongoose.Schema(
  {
    factor: {
      type: String,
      enum: [
        'HIGH_BERTH_UTILIZATION',
        'HIGH_VESSEL_QUEUE',
        'HIGH_ARRIVAL_RATE',
        'CRANE_SHORTFALL',
        'LARGE_VESSEL_CONCENTRATION',
        'SCHEDULE_OVERLAP',
        'MAINTENANCE_REDUCTION',
        'HISTORICAL_PATTERN',
      ],
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    value: {
      type: Number, // raw factor value before weighting
    },
    description: {
      type: String,
    },
  },
  { _id: false }
);

const congestionPredictionSchema = new mongoose.Schema(
  {
    predictionId: {
      type: String,
      required: true,
      unique: true,
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
    terminalName: {
      type: String,
    },
    // Prediction horizon
    horizon: {
      type: String,
      enum: ['6H', '12H', '24H', '72H'],
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    // Scores
    congestionScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
    },
    // Predicted metrics
    predictedWaitingHours: {
      type: Number,
      default: 0,
    },
    berthUtilizationForecast: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    vesselQueueForecast: {
      type: Number,
      default: 0,
    },
    // Raw factor inputs (stored for explainability)
    factorInputs: {
      berthUtilizationFactor: { type: Number },
      vesselQueueFactor: { type: Number },
      arrivalRateFactor: { type: Number },
      craneShortfallFactor: { type: Number },
      largeVesselFactor: { type: Number },
    },
    contributingFactors: [contributingFactorSchema],
    // Affected resources
    affectedBerthIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Berth',
      },
    ],
    // Model metadata
    modelType: {
      type: String,
      enum: ['ANALYTICAL_SCORING', 'STATISTICAL', 'ML'],
      default: 'ANALYTICAL_SCORING',
    },
    confidence: {
      type: Number,
      default: 0.75,
      min: 0,
      max: 1,
    },
    dataLabel: {
      type: String,
      default: 'SYNTHETIC DEMO DATA — NOT REAL PORT DATA',
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

congestionPredictionSchema.index({ terminalId: 1, generatedAt: -1 });
congestionPredictionSchema.index({ terminalCode: 1, horizon: 1 });
congestionPredictionSchema.index({ riskLevel: 1 });
congestionPredictionSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('CongestionPrediction', congestionPredictionSchema);
