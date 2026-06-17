import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotification } from './useNotification';

beforeEach(() => {
  vi.useFakeTimers();
  // Clear any toasts/confirms left from a previous test (shared module state).
  const n = useNotification();
  n.state.toasts.forEach((t) => n.dismiss(t.id));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useNotification', () => {
  it('pushes a toast and auto-dismisses it after the timeout', () => {
    const n = useNotification();
    const id = n.toast('salut', { timeoutMs: 1000 });
    expect(n.state.toasts.some((t) => t.id === id)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(n.state.toasts.some((t) => t.id === id)).toBe(false);
  });

  it('success and error helpers set the right kind', () => {
    const n = useNotification();
    n.success('done');
    n.error('nope');
    const kinds = n.state.toasts.map((t) => t.kind);
    expect(kinds).toContain('success');
    expect(kinds).toContain('error');
  });

  it('dismiss removes a toast immediately', () => {
    const n = useNotification();
    const id = n.toast('x', { timeoutMs: 0 }); // no auto-dismiss
    expect(n.state.toasts.some((t) => t.id === id)).toBe(true);
    n.dismiss(id);
    expect(n.state.toasts.some((t) => t.id === id)).toBe(false);
  });

  it('confirm resolves true when accepted', async () => {
    const n = useNotification();
    const p = n.confirm('sigur?');
    const req = n.state.confirms[n.state.confirms.length - 1];
    n.resolveConfirm(req.id, true);
    await expect(p).resolves.toBe(true);
    expect(n.state.confirms.some((c) => c.id === req.id)).toBe(false);
  });

  it('confirm resolves false when cancelled', async () => {
    const n = useNotification();
    const p = n.confirm('sigur?');
    const req = n.state.confirms[n.state.confirms.length - 1];
    n.resolveConfirm(req.id, false);
    await expect(p).resolves.toBe(false);
  });
});
