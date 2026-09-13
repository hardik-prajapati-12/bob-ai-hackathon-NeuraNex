'use strict';

const mongoose = require('mongoose');

const planActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    reason: { type: String, required: true },
    affectedResource: { type: String },
    affectedResourceType: {
      type: String,
      enum: ['VESSEL', 'BERTH', 'CRANE', 'TERMINAL', 'SCHEDULE', 'GENERAL'],
      default: 'GENERAL',
    },
    expectedBenefit: { type: String },
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
    vesselId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vessel',
      default: null,
    },
    berthId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Berth',
      default: null,
    },
  },
  { _id: false }
);

const planWindowSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      enum: ['0-12H', '12-24H', '24-48H', '48-72H'],
      required: true,
    },
    title: { type: String, required: true },
    summary: { type: String },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    actions: [planActionSchema],
  },
  { _id: false }
);

const operationsPlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: true,
      unique: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: String,
      enum: ['AI_ENGINE', 'MANUAL', 'SYSTEM'],
      default: 'AI_ENGINE',
    },
    horizon: {
      type: String,
      default: '72H',
    },
    terminalIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Terminal',
      },
    ],
    terminalCodes: [{ type: String }],
    windows: [planWindowSchema],
    summary: {
      type: String,
      default: null,
    },
    overallRiskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    isDemoData: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

operationsPlanSchema.index({ generatedAt: -1 });
operationsPlanSchema.index({ status: 1 });

module.exports = mongoose.model('OperationsPlan', operationsPlanSchema);
