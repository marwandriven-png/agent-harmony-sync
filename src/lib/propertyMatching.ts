import { Property, Lead } from '@/types/crm';

interface MatchResult {
  property: Property;
  score: number;
  matchReasons: string[];
}

export function matchProperties(lead: Lead, properties: Property[]): MatchResult[] {
  const results: MatchResult[] = [];

  for (const property of properties) {
    if (property.status !== 'available') continue;

    let score = 0;
    const matchReasons: string[] = [];

    // Price match (within budget)
    if (property.price >= lead.budget.min && property.price <= lead.budget.max) {
      score += 30;
      matchReasons.push('Within budget');
    } else if (property.price <= lead.budget.max * 1.1) {
      score += 15;
      matchReasons.push('Slightly above budget');
    }

    // Property type match
    if (lead.requirements.propertyType.includes(property.type)) {
      score += 25;
      matchReasons.push('Property type match');
    }

    // Bedroom match
    const bedroomDiff = Math.abs(property.bedrooms - lead.requirements.bedrooms);
    if (bedroomDiff === 0) {
      score += 25;
      matchReasons.push('Exact bedroom count');
    } else if (bedroomDiff === 1) {
      score += 15;
      matchReasons.push('Similar bedroom count');
    }

    // Location match
    const locationMatch = lead.requirements.locations.some(loc => 
      property.location.toLowerCase().includes(loc.toLowerCase()) ||
      loc.toLowerCase().includes(property.location.toLowerCase())
    );
    if (locationMatch) {
      score += 20;
      matchReasons.push('Location match');
    }

    if (score >= 30) {
      results.push({ property, score, matchReasons });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
