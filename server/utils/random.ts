import type { Candidate, WeightedCandidates, UniformCandidates, GaussianCandidate } from '../defs/def-random';

import { AppError } from './errors';

export function pickWeighted(candidates: WeightedCandidates): Candidate {
	const firstEntry = candidates.keys().next().value;
	if(!firstEntry){
		throw new AppError('No candidates for weighted selection', 'bug');
	}

	let total = 0;
	for(const weight of candidates.values()){
		if(weight < 0){
			throw new AppError('Negative weight provided', 'bug');
		}
		total += weight;
	}

	if(total <= 0){
		throw new AppError('Improper weights provided', 'bug');
	}

	let range = Math.random() * total;
	let currentCandidate: Candidate = firstEntry;

	for (const [candidate, weight] of candidates) {
		range -= weight;
		if(range <= 0){
			return candidate;
		}
		currentCandidate = candidate;
	}

	return currentCandidate;
}

export function pickUniform(candidates: UniformCandidates): Candidate {
	if(candidates.length === 0){
		throw new AppError('No candidates for uniform selection', 'bug');
	}

	const index = Math.floor(Math.random() * candidates.length);
	return candidates[index];
}

export function pickGaussian(input: GaussianCandidate): number {
	const standardDev = input.baseline / 3;

	const random1 = Math.random();
	const random2 = Math.random();
	const signedBellPosition = Math.sqrt(-2 * Math.log(random1)) * Math.cos(2 * Math.PI * random2);

	const result = input.baseline + (signedBellPosition * standardDev);

	const clamped = Math.min(Math.max(result, 0), input.baseline * 2);
	return clamped;
}

export function randomInt(min: number, max: number): number {
	if(min > max){
		throw new AppError('randomInt called with min greater than max', 'bug');
	}

	return Math.floor(Math.random() * (max - min + 1)) + min;
}
