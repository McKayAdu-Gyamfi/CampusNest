import { describe, it, expect, vi, beforeEach } from 'vitest';

const cmMock = vi.hoisted(() => vi.fn());
const cqMock = vi.hoisted(() => vi.fn());
vi.mock('../src/config/convexClient.js', () => ({ cm: cmMock, cq: cqMock, ca: vi.fn() }));

import { createComplaint } from '../src/modules/complaints/complaints.controller.js';

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

describe('createComplaint anti-spoofing', () => {
  it('derives hostel_manager_id from the hostel and forces student_id to the caller', async () => {
    // calls in order: getManagerId, listIdsByHostel, existsForStudentInRooms
    cqMock
      .mockReset()
      .mockResolvedValueOnce({ manager_id: 'real-manager' })
      .mockResolvedValueOnce(['room1'])
      .mockResolvedValueOnce(true);
    cmMock.mockResolvedValue({ id: 'c1' });

    const req = {
      user: { id: 'student-me', user_type: 'STUDENT' },
      body: {
        hostel_id: 'h1',
        content: 'No water',
        hostel_manager_id: 'hostile-manager',
        student_id: 'someone-else',
      },
    };
    const res = makeRes();
    const next = vi.fn();

    await createComplaint(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(cmMock).toHaveBeenCalledTimes(1);
    const sent = cmMock.mock.calls[0][1].data;
    expect(sent.hostel_manager_id).toBe('real-manager');
    expect(sent.student_id).toBe('student-me');
    expect(sent.content).toBe('No water');
  });
});
