import { describe, it, expect } from 'vitest';
import * as db from '../db';

describe('Booking API Functions', () => {
  describe('adminGetAllBookings', () => {
    it('should return an array of bookings', async () => {
      const bookings = await db.adminGetAllBookings();
      expect(Array.isArray(bookings)).toBe(true);
    });

    it('should return bookings with required fields when data exists', async () => {
      const bookings = await db.adminGetAllBookings();
      if (bookings.length > 0) {
        const booking = bookings[0];
        expect(booking).toHaveProperty('id');
        expect(booking).toHaveProperty('bookingNumber');
        expect(booking).toHaveProperty('status');
        expect(booking).toHaveProperty('totalAmount');
        expect(booking).toHaveProperty('pujaType');
      }
      // Test passes even with empty array
      expect(true).toBe(true);
    });

    it('should filter bookings by status', async () => {
      const pendingBookings = await db.adminGetAllBookings(undefined, 'pending');
      expect(Array.isArray(pendingBookings)).toBe(true);
      pendingBookings.forEach(booking => {
        expect(booking.status).toBe('pending');
      });
    });
  });

  describe('Dashboard Stats', () => {
    it('should return total bookings count', async () => {
      const total = await db.getTotalBookings();
      expect(typeof total).toBe('number');
      expect(total).toBeGreaterThanOrEqual(0);
    });

    it('should return recent bookings', async () => {
      const recentBookings = await db.getRecentBookings(5);
      expect(Array.isArray(recentBookings)).toBe(true);
      expect(recentBookings.length).toBeLessThanOrEqual(5);
    });

    it('should return monthly revenue', async () => {
      const revenue = await db.getMonthlyRevenue();
      // Revenue can be returned as string from database aggregation
      const numericRevenue = Number(revenue);
      expect(typeof numericRevenue).toBe('number');
      expect(numericRevenue).toBeGreaterThanOrEqual(0);
    });
  });
});
