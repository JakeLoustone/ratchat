type Candidate = string;
type Weight = number;
export type WeightedMap = Map<Candidate, Weight>;

export function weightedRandom(candidates: WeightedMap): Candidate {
    const firstEntry = candidates.keys().next().value;
	if(!firstEntry){
		throw new Error ('No candidates for weighted selection')
	}

	let total = 0;
	for(const weight of candidates.values()){
		total += weight;
	}

	let range = Math.random() * total;
    let currentCandidate: Candidate = firstEntry

	for (const [candidate, weight] of candidates) {
		range -= weight;
		if (range <= 0) return candidate;
        currentCandidate = candidate;
	}

    return currentCandidate;
}