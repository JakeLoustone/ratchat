import type { z } from "zod";

import { IdentitySchema, ServerConfigSchema, MarkovConfigSchema, GameConfigSchema } from "../../shared/schema";
import { Config, ConfigSchema, DefaultGameIdentity, DefaultIdentity, GameIdentity, GameIdentitySchema, Identity } from "../../shared/schema";
import { AppError } from "./errors";

export function mergeDefaults<T extends Config>(input: unknown, defaults: T, schema: ConfigSchema): T
export function mergeDefaults(input: unknown, defaults: DefaultIdentity, schema: typeof IdentitySchema): Identity
export function mergeDefaults(input: unknown, defaults: DefaultGameIdentity, schema: typeof GameIdentitySchema): GameIdentity
export function mergeDefaults(input: unknown, defaults: Config | DefaultIdentity | DefaultGameIdentity, schema: ConfigSchema | typeof IdentitySchema | typeof GameIdentitySchema): Config | Identity | GameIdentity {
	const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
	const name = getDefaultSchemaName(schema);
	const merged: Record<string, unknown> = {};

	for(const key of Object.keys(shape)){
		const fieldSchema = shape[key] as z.ZodTypeAny;
		const val = (input as Record<string, unknown>)?.[key];
		const def = (defaults as Record<string, unknown>)[key];

		const parsed = fieldSchema.safeParse(val);
		if(!parsed.success && val !== undefined){
			console.warn(`Merge Defaults on ${name} invalid value for ${key}: '${JSON.stringify(val)}' — using default`);
		}
		merged[key] = parsed.success ? parsed.data : def;
	}
	
	return parseMergedDefaults(merged, schema);
}

export function parseEntryArray<T>(parsed: unknown[], schema: z.ZodType<T>): T[]{
	return parsed.filter((entry): entry is T => schema.safeParse(entry).success);
}

function parseMergedDefaults(input: Record<string, unknown>, schema: ConfigSchema | typeof IdentitySchema | typeof GameIdentitySchema): Config | Identity | GameIdentity{
	if(schema === IdentitySchema){
		return IdentitySchema.parse(input);
	}
	else if(schema === GameIdentitySchema){
		return GameIdentitySchema.parse(input);
	}
	else if(schema === ServerConfigSchema){
		return ServerConfigSchema.parse(input);
	} 
	else if(schema === MarkovConfigSchema){
		return MarkovConfigSchema.parse(input);
	} 
	else if(schema === GameConfigSchema){
		return GameConfigSchema.parse(input);
	}
	else{
		throw new AppError("Unknown merge schema", 'bug');
	}
}

function getDefaultSchemaName(schema: ConfigSchema | typeof IdentitySchema | typeof GameIdentitySchema): string {
	if(schema === IdentitySchema){
		return 'Identity';
	}
	else if(schema === GameIdentitySchema){
		return 'GameIdentity';
	}
	else if(schema === ServerConfigSchema){
		return 'ServerConfig';
	}
	else if(schema === MarkovConfigSchema){
		return 'MarkovConfig';
	}
	else if(schema === GameConfigSchema){
		return 'GameConfig';
	}
	else{
		return 'Unknown';
	}
}


