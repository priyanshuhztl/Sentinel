'use client';

import { useState, useEffect } from 'react';

export interface PlanPreset {
  label: string;
  monthlyUsd: number;
  monthlyReqBudget: number;
}

export const PLAN_PRESETS: PlanPreset[] = [
  { label: 'Pro',       monthlyUsd: 20,  monthlyReqBudget: 5_000   },
  { label: 'Max',       monthlyUsd: 100, monthlyReqBudget: 25_000  },
  { label: 'Max Ultra', monthlyUsd: 200, monthlyReqBudget: 100_000 },
];

// 5-hour windows per month: 30 days × (24h / 5h) ≈ 144
const WINDOWS_PER_MONTH = 144;

export interface SubValueResult {
  value: number;
  // label describing how the value was derived
  label: string;
}

export function usePlan() {
  const [monthlyUsd, setMonthlyUsd] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tw_plan_monthly_usd');
    if (stored) setMonthlyUsd(parseFloat(stored));
    setLoaded(true);
  }, []);

  function setPlan(usd: number | null) {
    setMonthlyUsd(usd);
    if (usd == null) localStorage.removeItem('tw_plan_monthly_usd');
    else localStorage.setItem('tw_plan_monthly_usd', String(usd));
  }

  /**
   * Subscription value consumed by THIS chat.
   *
   * Strategy A (sessionPct available):
   *   sessionPct is the TOTAL window utilization across ALL chats, so we must
   *   scale it by this chat's share of tracked API cost:
   *     chatShare   = chatCost / totalCost          (capped at 1)
   *     effectivePct = chatShare × sessionPct
   *     value        = (effectivePct/100) × (monthly / WINDOWS_PER_MONTH)
   *
   * Strategy B (sessionPct unavailable):
   *   Estimate from request count vs monthly request budget.
   */
  function subValue(
    sessionPct: number | null,
    reqCount: number,
    chatCost: number,
    totalCost: number,
  ): SubValueResult | null {
    if (monthlyUsd == null) return null;

    // sessionPct = 0 means fresh window — Anthropic hasn't registered the usage yet.
    // Treat it the same as null: fall through to the request-count estimate.
    if (sessionPct != null && sessionPct > 0 && totalCost > 0) {
      const chatShare    = Math.min(1, chatCost / totalCost);
      const effectivePct = chatShare * sessionPct;
      return {
        value: (effectivePct / 100) * (monthlyUsd / WINDOWS_PER_MONTH),
        label: `~${effectivePct.toFixed(1)}% of 5h window`,
      };
    }

    // Fallback: request-count estimate
    const preset = PLAN_PRESETS.find(p => p.monthlyUsd === monthlyUsd);
    const budget  = preset?.monthlyReqBudget ?? (monthlyUsd / 20) * 5_000;
    return {
      value: reqCount * (monthlyUsd / budget),
      label: `~${((reqCount / budget) * 100).toFixed(2)}% of monthly · est.`,
    };
  }

  return { monthlyUsd, setPlan, subValue, loaded };
}
