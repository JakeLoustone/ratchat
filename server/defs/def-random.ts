export type WeightedCandidates = Map<Candidate, Weight>;
export type UniformCandidates = Candidate[];
export type GaussianCandidate = {candidate: Candidate, baseline: Baseline};

export type Candidate = string;
export type Weight = number;
export type Baseline = number;
