import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvexError } from 'convex/values';

// The Convex client is mocked so the service's error mapping is exercised
// without a deployment. The mutation shape is the one the Convex side throws.
const cmMock = vi.hoisted(() => vi.fn());
vi.mock('../src/config/convexClient.js', () => ({ cm: cmMock, cq: vi.fn(), ca: vi.fn() }));

import * as service from '../src/modules/amenities/Amenities.service.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

beforeEach(() => {
  cmMock.mockReset();
});

const rejectWith = (data) => cmMock.mockRejectedValue(new ConvexError(data));

describe('Amenities.service error mapping', () => {
  it('maps DUPLICATE_AMENITY to a 409 with the user-facing message', async () => {
    rejectWith({ code: 'DUPLICATE_AMENITY' });
    const err = await service.addHostelAmenities('h1', ['WIFI']).catch((e) => e);
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('One or more of these amenities is already added');
  });

  it('maps HOSTEL_NOT_FOUND to a 404', async () => {
    rejectWith({ code: 'HOSTEL_NOT_FOUND' });
    const err = await service.updateHostelAmenities('h1', []).catch((e) => e);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Hostel not found');
  });

  it('maps ROOM_NOT_FOUND to a 404', async () => {
    rejectWith({ code: 'ROOM_NOT_FOUND' });
    const err = await service.addRoomAmenities('r1', ['WIFI']).catch((e) => e);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Room not found');
  });

  it('does not relabel an unrecognised error as a client error', async () => {
    const original = new Error('boom');
    cmMock.mockRejectedValue(original);
    const err = await service.removeRoomAmenity('x', 'r1').catch((e) => e);
    expect(err).toBe(original);
    // No statusCode means errorHandler treats it as non-deliberate and
    // hides the message behind a generic 500.
    expect(err.statusCode).toBeUndefined();
  });

  it('keeps a secret-bearing unrecognised error out of the response body', async () => {
    // Shape of a Convex extra-field ArgumentValidationError: it echoes the
    // whole args object, adapter secret included. If wrapError attached a
    // statusCode, errorHandler would return this verbatim to the caller.
    const FAKE_SECRET = 'FAKE-ADAPTER-SECRET-789';
    cmMock.mockRejectedValue(
      new Error(
        'ArgumentValidationError: Object contains extra field `roomId` that is not in the validator. ' +
          `Object: {id: "x", roomId: "r1", secret: "${FAKE_SECRET}"}`,
      ),
    );

    const err = await service.removeRoomAmenity('x', 'r1').catch((e) => e);
    expect(err.statusCode).toBeUndefined();

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(err, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain(FAKE_SECRET);
    expect(body.message).toBe('Internal Server Error');
  });

  it('forwards successful results unchanged', async () => {
    cmMock.mockResolvedValue([{ id: 'a1', name: 'GYM' }]);
    await expect(service.updateRoomAmenities('r1', ['GYM'])).resolves.toEqual([{ id: 'a1', name: 'GYM' }]);
  });
});
