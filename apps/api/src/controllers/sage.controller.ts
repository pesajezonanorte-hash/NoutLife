import { publicErrorMessage } from '../middleware/error.middleware';
import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  sageChat,
  sageSuggestQuests,
  sageAnalyzeHabits,
  sageAnalyzeFinances,
  sagePlanWorkout,
  sageDailySummary,
  sageDailyTip,
  getSageRateInfo,
} from '../services/sage.service';

export async function chat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) { res.status(400).json({ error: 'message requerido' }); return; }
    const reply = await sageChat(req.userId!, message.trim());
    res.json({ reply });
  } catch (error) {
    console.error('[Sage controller] chat error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function suggestQuests(req: AuthRequest, res: Response): Promise<void> {
  try {
    const raw = await sageSuggestQuests(req.userId!);
    try {
      const quests = JSON.parse(raw);
      res.json({ quests });
    } catch {
      res.json({ quests: [], raw });
    }
  } catch (error) {
    console.error('[Sage controller] suggestQuests error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function analyzeHabits(req: AuthRequest, res: Response): Promise<void> {
  try {
    const reply = await sageAnalyzeHabits(req.userId!);
    res.json({ reply });
  } catch (error) {
    console.error('[Sage controller] analyzeHabits error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function analyzeFinances(req: AuthRequest, res: Response): Promise<void> {
  try {
    const reply = await sageAnalyzeFinances(req.userId!);
    res.json({ reply });
  } catch (error) {
    console.error('[Sage controller] analyzeFinances error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function planWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const reply = await sagePlanWorkout(req.userId!);
    res.json({ reply });
  } catch (error) {
    console.error('[Sage controller] planWorkout error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function dailySummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const reply = await sageDailySummary(req.userId!);
    res.json({ reply });
  } catch (error) {
    console.error('[Sage controller] dailySummary error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function dailyTip(req: AuthRequest, res: Response): Promise<void> {
  try {
    const reply = await sageDailyTip(req.userId!);
    res.json({ tip: reply });
  } catch (error) {
    console.error('[Sage controller] dailyTip error:', error);
    res.status(500).json({ tip: 'Sigue con tu racha — cada día cuenta.' });
  }
}

export async function rateInfo(req: AuthRequest, res: Response): Promise<void> {
  try {
    const info = await getSageRateInfo(req.userId!);
    res.json(info);
  } catch (error) {
    console.error('[Sage controller] rateInfo error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}
