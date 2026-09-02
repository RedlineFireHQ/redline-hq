export type FireExtinguisherReadinessItem = {
	status: "Active" | "Inactive" | "Out of Service";
	hasOpenDeficiency: boolean;
};

export type FireExtinguisherReadinessResult = {
	isRated: boolean;
	readinessPercent: number | null;
	trackedExtinguisherCount: number;
	readyExtinguisherCount: number;
	outOfServiceCount: number;
	inactiveCount: number;
	openDeficiencyCount: number;
};

export function calculateFireExtinguisherReadiness(
	items: FireExtinguisherReadinessItem[],
): FireExtinguisherReadinessResult {
	let trackedExtinguisherCount = 0;
	let readyExtinguisherCount = 0;
	let outOfServiceCount = 0;
	let inactiveCount = 0;
	let openDeficiencyCount = 0;

	for (const item of items) {
		if (item.status === "Inactive") {
			inactiveCount += 1;
			continue;
		}

		if (item.status === "Out of Service") {
			outOfServiceCount += 1;
			continue;
		}

		trackedExtinguisherCount += 1;

		if (item.hasOpenDeficiency) {
			openDeficiencyCount += 1;
			continue;
		}

		readyExtinguisherCount += 1;
	}

	if (trackedExtinguisherCount === 0) {
		return {
			isRated: false,
			readinessPercent: null,
			trackedExtinguisherCount,
			readyExtinguisherCount,
			outOfServiceCount,
			inactiveCount,
			openDeficiencyCount,
		};
	}

	return {
		isRated: true,
		readinessPercent: (readyExtinguisherCount / trackedExtinguisherCount) * 100,
		trackedExtinguisherCount,
		readyExtinguisherCount,
		outOfServiceCount,
		inactiveCount,
		openDeficiencyCount,
	};
}
