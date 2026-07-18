export interface ReadinessCategory {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
}

export interface ReadinessPriority {
  title: string;
  description: string;
  pointsAvailable: number;
}

export interface ReadinessResult {
  overallScore: number;
  weightedScore: number;
  status: string;
  color: string;
  priorities: ReadinessPriority[];
}

export const DEFAULT_CATEGORIES: ReadinessCategory[] = [
  {
    id: "training",
    name: "Training",
    score: 20,
    maxScore: 20,
    weight: 20,
  },
  {
    id: "certifications",
    name: "Certifications",
    score: 20,
    maxScore: 20,
    weight: 20,
  },
  {
    id: "apparatus",
    name: "Apparatus",
    score: 20,
    maxScore: 20,
    weight: 20,
  },
  {
    id: "personnel",
    name: "Personnel",
    score: 20,
    maxScore: 20,
    weight: 20,
  },
  {
    id: "inventory",
    name: "Inventory",
    score: 20,
    maxScore: 20,
    weight: 20,
  },
];

export function calculateReadiness(
  categories: ReadinessCategory[]
): ReadinessResult {
  const totalWeight = categories.reduce(
    (sum, category) => sum + category.weight,
    0
  );

  const weightedScore = categories.reduce((sum, category) => {
    const percentage = category.score / category.maxScore;
    return sum + percentage * category.weight;
  }, 0);

  const overallScore = Math.round((weightedScore / totalWeight) * 100);

  let status = "NOT READY";
  let color = "red";

  if (overallScore >= 90) {
    status = "REDLINE READY";
    color = "green";
  } else if (overallScore >= 80) {
    status = "NEAR READY";
    color = "yellow";
  } else if (overallScore >= 70) {
    status = "NEEDS ATTENTION";
    color = "orange";
  }

  return {
    overallScore,
    weightedScore,
    status,
    color,
    priorities: [],
  };
}