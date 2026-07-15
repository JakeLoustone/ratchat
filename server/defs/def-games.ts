import type { GameIdentity } from './def-identity';

export type FishCatch = {
	name: string;
	flavor: string;
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
