'use strict';

const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
  {
    recommendationId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: [
        'BERTH_REALLOCATION',
        'CRANE_REASSIGNMENT',
        'VESSEL_DELAY',
        'REROUTING',
        'CRANE_ADDITION',
        'SCHEDULE_ADJUSTMENT',
      ],
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
    // Current vs recommended
    currentBerthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
    recommendedBerthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
    currentCraneIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Crane',
      },
    ],
    recommendedCraneIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Crane',
      },
    ],
    // Explanation
    reason: {
      type: String,
      required: true,
    },
    aiExplanation: {
      type: String,
      default: null,
    },
    // Impact
    expectedBenefitHours: {
      type: Number,
      default: 0,
    },
    expectedBenefitDescription: {
      type: String,
      default: null,
    },
    // Priority / confidence
    priority: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'MEDIUM',
    },
    confidence: {
      type: Number,
      default: 0.75,
      min: 0,
      max: 1,
    },
    // Status
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'],
      default: 'PENDING',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

recommendationSchema.index({ terminalId: 1, generatedAt: -1 });
recommendationSchema.index({ vesselId: 1 });
recommendationSchema.index({ status: 1 });
recommendationSchema.index({ priority: 1, status: 1 });
recommendationSchema.index({ type: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);
