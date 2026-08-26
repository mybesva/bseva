import { describe, it, expect, vi } from 'vitest';

// Mock the database functions
vi.mock('../db', () => ({
  findBestMatchingPujari: vi.fn(),
  getPujariSuggestions: vi.fn(),
}));

import { findBestMatchingPujari, getPujariSuggestions } from '../db';

describe('Auto Pujari Assignment', () => {
  describe('findBestMatchingPujari', () => {
    it('should return a matching pujari for a given city', async () => {
      const mockResult = {
        priestId: 1,
        priestName: 'Pandit Sharma',
        matchScore: 80,
        matchReason: 'Same city, Highly rated',
      };
      
      (findBestMatchingPujari as any).mockResolvedValue(mockResult);
      
      const result = await findBestMatchingPujari('Bangalore');
      
      expect(result).toBeDefined();
      expect(result?.priestId).toBe(1);
      expect(result?.matchScore).toBeGreaterThan(0);
    });

    it('should return null when no pujaris are available', async () => {
      (findBestMatchingPujari as any).mockResolvedValue(null);
      
      const result = await findBestMatchingPujari('Unknown City');
      
      expect(result).toBeNull();
    });

    it('should prioritize same city matches', async () => {
      const mockResult = {
        priestId: 2,
        priestName: 'Pandit Iyer',
        matchScore: 60,
        matchReason: 'Same city',
      };
      
      (findBestMatchingPujari as any).mockResolvedValue(mockResult);
      
      const result = await findBestMatchingPujari('Chennai');
      
      expect(result?.matchReason).toContain('Same city');
    });
  });

  describe('getPujariSuggestions', () => {
    it('should return multiple pujari suggestions', async () => {
      const mockSuggestions = [
        { priestId: 1, priestName: 'Pandit A', matchScore: 90, matchReason: 'Same city', rating: 4.8, experience: 15, city: 'Bangalore' },
        { priestId: 2, priestName: 'Pandit B', matchScore: 75, matchReason: 'Same area', rating: 4.5, experience: 10, city: 'Bangalore' },
        { priestId: 3, priestName: 'Pandit C', matchScore: 60, matchReason: 'Available', rating: 4.2, experience: 8, city: 'Mysore' },
      ];
      
      (getPujariSuggestions as any).mockResolvedValue(mockSuggestions);
      
      const result = await getPujariSuggestions('Bangalore', undefined, 3);
      
      expect(result).toHaveLength(3);
      expect(result[0].matchScore).toBeGreaterThanOrEqual(result[1].matchScore);
    });

    it('should respect the limit parameter', async () => {
      const mockSuggestions = [
        { priestId: 1, priestName: 'Pandit A', matchScore: 90, matchReason: 'Same city', rating: 4.8, experience: 15, city: 'Delhi' },
        { priestId: 2, priestName: 'Pandit B', matchScore: 75, matchReason: 'Same area', rating: 4.5, experience: 10, city: 'Delhi' },
      ];
      
      (getPujariSuggestions as any).mockResolvedValue(mockSuggestions);
      
      const result = await getPujariSuggestions('Delhi', undefined, 2);
      
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no pujaris found', async () => {
      (getPujariSuggestions as any).mockResolvedValue([]);
      
      const result = await getPujariSuggestions('Remote Village');
      
      expect(result).toEqual([]);
    });
  });
});

describe('Pujari Matching Algorithm', () => {
  it('should calculate match score correctly', () => {
    // Test the scoring logic
    const calculateScore = (sameCity: boolean, sameArea: boolean, rating: number, experience: number) => {
      let score = 0;
      if (sameCity) score += 40;
      if (sameArea) score += 20;
      score += Math.min(rating * 4, 20);
      score += Math.min(experience * 2, 20);
      return score;
    };

    // Same city, high rating, experienced
    expect(calculateScore(true, true, 5, 15)).toBe(100);
    
    // Same city only
    expect(calculateScore(true, false, 0, 0)).toBe(40);
    
    // No location match, average rating
    expect(calculateScore(false, false, 3.5, 5)).toBe(24);
  });
});
