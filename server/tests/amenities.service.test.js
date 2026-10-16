import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvexError } from 'convex/values';

// The Convex client is mocked so the service's error mapping is exercised
// without a deployment. The mutation shape is the one the Convex side throws.
const cmMock = vi.hoisted(() => vi.fn());
vi.mock('../src/config/convexClient.js', () => ({ cm: cmMock, cq: vi.fn(), ca: vi.fn() }));

import * as service from '../src/modules/amenities/Amenities.service.js';

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

  it('falls back to a 400 for an unrecognised error', async () => {
    cmMock.mockRejectedValue(new Error('boom'));
    const err = await service.removeRoomAmenity('x').catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('boom');
  });

  it('forwards successful results unchanged', async () => {
    cmMock.mockResolvedValue([{ id: 'a1', name: 'GYM' }]);
    await expect(service.updateRoomAmenities('r1', ['GYM'])).resolves.toEqual([{ id: 'a1', name: 'GYM' }]);
  });
});
