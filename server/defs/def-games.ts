import type { GameIdentity } from './def-identity';
import { FishRecordEntry, HorseRecordEntry } from './def-record';

export type FishCatch = {
	name: FishRecordEntry['fishName'];
	flavor: FishRecordEntry['fishFlavor'];
	weight: number;
	value: number;
};

export type FishResult = FishCatch & {
	record: boolean;
	pb: boolean;
	newcatch: boolean;
	big: boolean;
	small: boolean;
};

export type FishingEventType = typeof fType[keyof typeof fType];
export const fType = {
	bite: 'bite',
	nothing: 'nothing',
	expired: 'expired'
} as const;

export type FishingEventCallback = (playerid: GameIdentity['playerid'], event: FishingEventType) => void;

export type HorseOdds = {
	oddsNum: number;
	oddsDen: number;
}

export type HorseFieldEntry = {
	horseName: HorseRecordEntry['horseName'];
} & HorseOdds;

export type HorseRaceEntry = HorseFieldEntry & {
	weight: number;
	score: number;
}

export type HorseRaceResult = {
	field: HorseFieldEntry[];
	gates: string[];
	checkpoint1: string[];
	checkpoint2: string[];
	checkpoint3: string[];
	finalStretch: string[];
	end: string[];
	first: HorseRecordEntry['horseName'];
	second: HorseRecordEntry['horseName'];
	third: HorseRecordEntry['horseName'];
};

export type HorseBet = {
	playerid: GameIdentity['playerid'];
	horseName: HorseRecordEntry['horseName'];
	stake: number;
	oddsNum: number;
	oddsDen: number;
	prerace: boolean;
};
