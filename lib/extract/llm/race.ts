import type { OnAttempt } from "./types";

export type RunOutcome<T> =
  | { win: true; value: T }
  | { win: false; reason: string; understood?: boolean };

export interface Racer<T> {
  model: string;
  run: (signal: AbortSignal) => Promise<RunOutcome<T>>;
}

export interface RaceFailure { model: string; reason: string; understood?: boolean }

export type RaceOutcome<T> =
  | { ok: true; model: string; value: T }
  | { ok: false; failures: RaceFailure[] };

/**
 * Гоняет racers конкурентно. Резолвит первым же `win`, отменяя остальных
 * (их AbortSignal сработает). Если ни один не выиграл — собирает все провалы.
 * Каждый racer ограничен timeoutMs (по нему abort → провал «Таймаут»).
 * Эмитит onAttempt: start (для каждого racer), затем win | fail по мере ответа.
 */
export async function raceModels<T>(
  racers: Racer<T>[],
  opts: { timeoutMs: number; total?: number; onAttempt?: OnAttempt },
): Promise<RaceOutcome<T>> {
  const { timeoutMs, onAttempt } = opts;
  const total = opts.total ?? racers.length;
  if (racers.length === 0) return { ok: false, failures: [] };

  const controllers = racers.map(() => new AbortController());
  const timers: ReturnType<typeof setTimeout>[] = [];
  const failures: RaceFailure[] = [];
  let settled = false;
  let remaining = racers.length;

  return new Promise<RaceOutcome<T>>((resolve) => {
    const finish = (out: RaceOutcome<T>) => {
      settled = true;
      timers.forEach(clearTimeout);
      controllers.forEach((c) => c.abort()); // отменяем ещё бегущих
      resolve(out);
    };

    racers.forEach((racer, i) => {
      const ac = controllers[i];
      timers.push(setTimeout(() => ac.abort(), timeoutMs));
      onAttempt?.({ phase: "start", model: racer.model, total });
      racer.run(ac.signal).then(
        (outcome) => {
          if (settled) return;
          if (outcome.win) {
            onAttempt?.({ phase: "win", model: racer.model });
            finish({ ok: true, model: racer.model, value: outcome.value });
            return;
          }
          failures.push({ model: racer.model, reason: outcome.reason, understood: outcome.understood });
          onAttempt?.({ phase: "fail", model: racer.model, reason: outcome.reason });
          if (--remaining === 0) finish({ ok: false, failures });
        },
        (err) => {
          if (settled) return;
          const reason = ac.signal.aborted
            ? `Таймаут ответа модели (${racer.model})`
            : err instanceof Error ? err.message : String(err);
          failures.push({ model: racer.model, reason });
          onAttempt?.({ phase: "fail", model: racer.model, reason });
          if (--remaining === 0) finish({ ok: false, failures });
        },
      );
    });
  });
}
