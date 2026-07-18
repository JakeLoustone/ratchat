import {hType} from './def-events';
import type {GameTextPayload} from './def-events';
import type {GameIdentity} from './def-identity';
import type {FishRecordEntry, HorseRecordEntry} from './def-record';

export type HorseColor = typeof allowedHorseColors[keyof typeof allowedHorseColors];
export const allowedHorseColors = {
	[hType.blue]: hType.blue,
	[hType.brown]: hType.brown,
	[hType.black]: hType.black,
	[hType.gray]: hType.gray,
	[hType.navy]: hType.navy,
	[hType.green]: hType.green,
	[hType.orange]: hType.orange,
	[hType.pink]: hType.pink,
	[hType.purple]: hType.purple,
	[hType.teal]: hType.teal,
	[hType.red]: hType.red,
	[hType.white]: hType.white,
	[hType.yellow]: hType.yellow
} as const;

export type HorseOdds = {
	oddsNum: number;
	oddsDen: number;
}

export type HorseFieldEntry = {
	horsePost: number;
	horseColor: HorseColor;
	horseName: HorseRecordEntry['horseName'];
} & HorseOdds;

export type HorseRaceEntry = HorseFieldEntry & {
	weight: number;
	score: number;
}

export type HorseRaceResult = {
	field: HorseFieldEntry[];
	gates: GameTextPayload;
	checkpoint1: GameTextPayload;
	checkpoint2: GameTextPayload;
	checkpoint3: GameTextPayload;
	finalStretch: GameTextPayload;
	end: GameTextPayload;
	first: HorseRecordEntry['horseName'];
	firstPost: HorseFieldEntry['horsePost'];
	second: HorseRecordEntry['horseName'];
	secondPost: HorseFieldEntry['horsePost'];
	third: HorseRecordEntry['horseName'];
	thirdPost: HorseFieldEntry['horsePost'];
};

export type HorseBet = {
	playerid: GameIdentity['playerid'];
	horseName: HorseRecordEntry['horseName'];
	postNumber: HorseFieldEntry['horsePost'];
	stake: number;
	oddsNum: number;
	oddsDen: number;
	prerace: boolean;
};

export type FishCatch = {
	name: FishRecordEntry['fishName'];
	flavor: FishRecordEntry['fishFlavor'];
	color: FishRecordEntry['fishColor'];
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
