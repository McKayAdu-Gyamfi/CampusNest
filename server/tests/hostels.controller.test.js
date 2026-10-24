import { describe, it, expect, vi, beforeEach } from 'vitest';

const cmMock = vi.hoisted(() => vi.fn());
const cqMock = vi.hoisted(() => vi.fn());
vi.mock('../src/config/convexClient.js', () => ({ cm: cmMock, cq: cqMock, ca: vi.fn() }));
vi.mock('../src/config/db.js', () => ({ supabase: {} }));
vi.mock('../src/utils/supabaseStorage.js', () => ({ uploadImageToSupabase: vi.fn() }));

import { updateHostel } from '../src/modules/hostels/hostels.controller.js';
import { verifyHostelOwnership } from '../src/middlewares/verifyOwnership.js';

const makeRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

beforeEach(() => {
  cmMock.mockReset();
  cqMock.mockReset();
});

describe('updateHostel', () => {
  // api.hostels.update must accept status (the admin-only status endpoint uses
  // it), so this destructure is the only barrier against a manager
  // self-approving their hostel or transferring ownership.
  it('strips status and manager_id from the patch sent to Convex', async () => {
    cmMock.mockResolvedValue({ id: 'h1' });
    const req = {
      params: { id: 'h1' },
      body: { hostel_name: 'New Name', status: 'APPROVED', manager_id: 'someone-else' },
    };
    const res = makeRes();
    const next = vi.fn();

    await updateHostel(req, res, next);

    expect(cmMock).toHaveBeenCalledTimes(1);
    const args = cmMock.mock.calls[0][1];
    expect(args.id).toBe('h1');
    expect(args.patch).toHaveProperty('hostel_name', 'New Name');
    expect(args.patch).not.toHaveProperty('status');
    expect(args.patch).not.toHaveProperty('manager_id');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('verifyHostelOwnership', () => {
  const run = async (user, hostel) => {
    cqMock.mockResolvedValue(hostel);
    const req = { params: { id: 'h1' }, user };
    const res = makeRes();
    const next = vi.fn();
    await verifyHostelOwnership(req, res, next);
    return { res, next };
  };

  it('returns 404 and does not call next for a missing or malformed hostel', async () => {
    const { res, next } = await run({ id: 'u1', user_type: 'HOSTEL_MANAGER' }, null);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 and does not call next when another user manages the hostel', async () => {
    const { res, next } = await run({ id: 'u1', user_type: 'HOSTEL_MANAGER' }, { manager_id: 'u2' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets an ADMIN through despite the mismatch', async () => {
    const { res, next } = await run({ id: 'u1', user_type: 'ADMIN' }, { manager_id: 'u2' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lets the owning manager through', async () => {
    const { res, next } = await run({ id: 'u1', user_type: 'HOSTEL_MANAGER' }, { manager_id: 'u1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
