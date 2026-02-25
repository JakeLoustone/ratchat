import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

import type { Identity, ServerConfig } from '../../shared/types.ts'

import { ModerationService } from './moderation.ts';


export interface IdentityServiceDependencies{
	moderationService: ModerationService;
	
	config: ServerConfig;
	usersPath: string;
}

export class IdentityService {
	private users: Map<string, Identity> = new Map();
	private registeredNicks: Map<string, string> = new Map();
	private deps: IdentityServiceDependencies;

	constructor(dependencies: IdentityServiceDependencies) {
		this.deps = dependencies;
		this.loadUsers();
	}

	public setNick(guid: string | null, nick: string): Identity{
		//Nick santization and validation
		const sanitizeNick = nick.replace(/[^\w\s]/gi, '').trim();
		
		try{
			this.deps.moderationService.nickCheck(nick);
			this.deps.moderationService.nickCheck(sanitizeNick);
		}
		catch(error){
				throw error;
		}

		if (sanitizeNick.length < 2 || sanitizeNick.length > 15) {
			throw new Error('nickname must be between 2 and 15 characters')
		}

		//Returning user flow
		if (guid && this.users.has(guid)) {
			const user = this.users.get(guid)!;
			const oldNick = user.nick.substring(7);

			if(sanitizeNick === oldNick){
				throw new Error("that's already your name silly")
			}

			//allow capitilzation changes
			if(sanitizeNick.toLowerCase() !== oldNick.toLowerCase() && this.registeredNicks.has(sanitizeNick.toLowerCase())){
				throw new Error('nickname is already in use');
			}

			this.registeredNicks.delete(oldNick.toLowerCase());
			this.registeredNicks.set(sanitizeNick.toLowerCase(), guid);

			const color = user.nick.substring(0,7)
			user.nick = color + sanitizeNick;
			user.lastChanged = new Date();
			this.saveUsers();
			return user;
		}
		//New user flow
		else{
			if (this.registeredNicks.has(sanitizeNick.toLowerCase())) {
				throw new Error('nickname is already in use');
		}

		const newGuid = guid || uuidv4();
		const newIdentity: Identity = {
			guid: newGuid,
			nick: ('#000000') + sanitizeNick,
			lastChanged: new Date(0),
			status: 'online',
			isMod: false,
			lastMessage: new Date(0),
			isAfk: false,
		};

		this.users.set(newGuid, newIdentity);
		this.registeredNicks.set(sanitizeNick.toLowerCase(), newGuid);
		this.saveUsers();
		return newIdentity;
		}
	}

	public setColor(guid: string, color: string): Identity{
		const user = this.users.get(guid)!;
		const validColor = (color && /^#[0-9A-F]{6}$/i.test(color));
		if (!validColor) {
			throw new Error('invalid hex code. please use format #RRGGBB');
		}

		user.nick = color.toUpperCase() + user.nick.substring(7)
		user.lastChanged = new Date();
		this.saveUsers();
		return user;
	}

	public getUser(guid: string): Identity {
		const user = this.users.get(guid);
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		return user;
	}

	public toggleAfk(guid: string): Identity {
		const user = this.users.get(guid);
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		if(user.isAfk){
			user.isAfk = false;
			this.saveUsers();
		}
		else{
			user.isAfk = true;
			this.saveUsers();
		}
		return user;
	}

	public setStatus(guid: string, status: string): Identity {
		const user = this.users.get(guid);

		if(!user){
			throw new Error('No matching user found to GUID')
		}

		try{
			this.deps.moderationService.profCheck(status);
		}
		catch(error){
			throw (error);
		}

		user.status = status;
		this.saveUsers();
		return user;
	}

	public setLastMessage(guid: string, msgdate: number): Identity {
		const user = this.users.get(guid);
		const newDate = msgdate;
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		user.lastMessage = new Date(newDate);
		this.saveUsers();
		return user;
	}

	public getUserByNick(cleanNick: string): Identity {
		const guid = this.registeredNicks.get(cleanNick.trim().toLowerCase());
		if(!guid){
			throw new Error(`couldn't find user with nickname ${cleanNick}`);
		}
		const user = this.users.get(guid);
		if(!user){
			throw new Error(`couldn't find user with nickname ${cleanNick}`);
		}
		return user;
	}

	public deleteUser(guid: string): void {
		const user = this.users.get(guid);
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		const cleanNick = user.nick.substring(7);
		this.registeredNicks.delete(cleanNick.toLowerCase());
		this.users.delete(guid);
		this.saveUsers();
		console.log(`GDPR: Deleted user ${cleanNick} (${guid})`);
	}

	private loadUsers() {
	try {
		if (!existsSync(this.deps.usersPath)) {
			return;
			}

			const data = readFileSync(this.deps.usersPath, 'utf-8');
			const parseData: [string, Identity][] = JSON.parse(data);

			this.users = new Map(parseData);
			this.registeredNicks.clear();


			for (const [guid, identity] of this.users.entries()) {
			const existingNick = identity.nick.substring(7)
			this.registeredNicks.set(existingNick.toLowerCase(), guid);
			}
			console.log(`loaded ${this.users.size} users`);
		} catch (e: any) {
			console.error('Failed to load user data', `${e.message}`);
		}
	};

	private saveUsers() {
		try {
			const dir = dirname(this.deps.usersPath);
			if (!existsSync(dir)) {
			mkdirSync(dir, {recursive: true});
			}

			const data = Array.from(this.users.entries());
			writeFileSync(this.deps.usersPath, JSON.stringify(data, null, 4));
		} catch (e: any) {
			console.error('failed to save user data', `${e.message}`);
		}
	};
}