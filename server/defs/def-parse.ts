export type SchemaType = typeof aType[keyof typeof aType];
export const aType = {
	id: 'Identity',
	gid: 'GameIdentity',
	sconfig: 'ServerConfig',
	mconfig: 'MarkovConfig',
	gconfig: 'GameConfig',
	gfish: 'FishRecord',
	ghorse: 'HorseRecord'
} as const;

export type ParseFailureRecord = {
	raw: unknown;
	label: SchemaType;
	field: string;
	invalidValue: unknown;
	substitutedValue: unknown;
};
export type KeyedParseFailureRecord = ParseFailureRecord & {
	recordKey: string;
};
