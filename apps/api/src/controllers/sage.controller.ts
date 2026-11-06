import { publicErrorMessage } from '../middleware/error.middleware';
import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { localeOf } from '../lib/request-locale';
import {
  sageChat,
  sageSuggestQuests,
  sageAnalyzeHabits,
  sageAnalyzeFinances,
  sagePlanWorkout,
  sageDailySummary,
  sageDailyTip,
  getSageRateInfo,
  localizeSageReply,
} from '../services/sage.service';
import { applySageFinanceAction, parseSageFinanceAction } from '../services/sage-actions.service';

export async function chat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) { res.status(400).json({ error: 'message requerido' }); return; }
    const lang = localeOf(req);
    const { reply, action, goalTitle } = await sageChat(req.userId!, message.trim(), lang);
    res.json({ reply: localizeSageReply(reply, lang), action, goalTitle });
  } catch (error) {
    console.error('[Sage controller] chat error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

/** Confirmación de una propuesta del Sabio: se vuelve a validar aquí y se aplica con los servicios de Finanzas. */
export async function applyAction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parsed = parseSageFinanceAction(req.body?.action);
    if (!parsed.ok) { res.status(400).json({ message: parsed.message }); return; }
    const goal = await applySageFinanceAction(req.userId!, parsed.action);
    res.json({ goal });
  } catch (error) {
    res.status(400).json({ message: publicErrorMessage(error) });
  }
}

export async function suggestQuests(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lang = localeOf(req);
    const raw = await sageSuggestQuests(req.userId!, lang);
    try {
      const quests = JSON.parse(raw);
      res.json({ quests });
    } catch {
      res.json({ quests: [], raw: localizeSageReply(raw, lang) });
    }
  } catch (error) {
    console.error('[Sage controller] suggestQuests error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function analyzeHabits(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lang = localeOf(req);
    const reply = await sageAnalyzeHabits(req.userId!, lang);
    res.json({ reply: localizeSageReply(reply, lang) });
  } catch (error) {
    console.error('[Sage controller] analyzeHabits error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function analyzeFinances(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lang = localeOf(req);
    const reply = await sageAnalyzeFinances(req.userId!, lang);
    res.json({ reply: localizeSageReply(reply, lang) });
  } catch (error) {
    console.error('[Sage controller] analyzeFinances error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function planWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lang = localeOf(req);
    const reply = await sagePlanWorkout(req.userId!, lang);
    res.json({ reply: localizeSageReply(reply, lang) });
  } catch (error) {
    console.error('[Sage controller] planWorkout error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function dailySummary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const lang = localeOf(req);
    const reply = await sageDailySummary(req.userId!, lang);
    res.json({ reply: localizeSageReply(reply, lang) });
  } catch (error) {
    console.error('[Sage controller] dailySummary error:', error);
    res.status(500).json({ error: 'sage_error', message: publicErrorMessage(error) });
  }
}

export async function dailyTip(req: AuthRequest, res: Response): Promise<void> {
  const lang = localeOf(req);
  try {
    const reply = await sageDailyTip(req.userId!, lang);
    res.json({ tip: localizeSageReply(reply, lang) });
  } catch (error) {
    console.error('[Sage controller] dailyTip error:', error);
    res.status(500).json({ tip: localizeSageReply('Sigue con tu racha — cada día cuenta.', lang) });
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
