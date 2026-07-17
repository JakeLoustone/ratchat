import type { Identity } from '../defs/def-identity';

const DISPLAY_COLOR_LENGTH = 7;

export function getBaseNick(fullNick: Identity['fullnick']): string{
	return fullNick.substring(DISPLAY_COLOR_LENGTH);
}

export function getNickColor(fullNick: Identity['fullnick']): string{
	return fullNick.substring(0, DISPLAY_COLOR_LENGTH);
}

export function getOrdinalSuffix(value: number): string {
	const lastTwoDigits = value % 100;
	if(lastTwoDigits >= 11 && lastTwoDigits <= 13){
		return 'th';
	}

	const lastDigit = value % 10;
	if(lastDigit === 1){
		return 'st';
	}
	if(lastDigit === 2){
		return 'nd';
	}
	if(lastDigit === 3){
		return 'rd';
	}

	return 'th';
}
