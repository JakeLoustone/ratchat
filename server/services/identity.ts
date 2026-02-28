import { v4 as uuidv4 } from 'uuid';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

import type { Identity } from '../../shared/schema.ts'

import { ModerationService, type SafeString } from './moderation';
import { StateService } from './state';

export interface IdentityServiceDependencies{
	moderationService: ModerationService;
	stateService: StateService;

	usersPath: string;
}

export class IdentityService {
	private users: Map<string, Identity> = new Map();
	private registeredNicks: Map<string, string> = new Map();
	private deps: IdentityServiceDependencies;

	constructor(dependencies: IdentityServiceDependencies) {
		this.deps = dependencies;
		this.loadUsers();
		
		this.deps.stateService.events.on("afk-check", guid => {
			this.toggleAfk(guid); 
		});
	}

	public setNick(guid: string | null, nick: SafeString): Identity{
		//Returning user flow
		if (guid && this.users.has(guid)) {
			const user = this.users.get(guid)!;
			const oldNick = user.nick.substring(7);

			if(nick === oldNick){
				throw new Error("that's already your name silly")
			}

			//allow capitilzation changes
			if(nick.toLowerCase() !== oldNick.toLowerCase() && this.registeredNicks.has(nick.toLowerCase())){
				throw new Error('nickname is already in use');
			}

			this.registeredNicks.delete(oldNick.toLowerCase());
			this.registeredNicks.set(nick.toLowerCase(), guid);

			const color = user.nick.substring(0,7)
			user.nick = color + nick;
			user.lastChanged = new Date();
			this.saveUsers();
			return user;
		}
		//New user flow
		else{
			if (this.registeredNicks.has(nick.toLowerCase())) {
				throw new Error('nickname is already in use');
		}

		const newGuid = guid || uuidv4();
		const newIdentity: Identity = {
			guid: newGuid,
			nick: ('#000000') + nick,
			status: 'online',
			lastMessage: new Date(0),
			lastChanged: new Date(),
			isMod: false,
			isAfk: false,
		};

		this.users.set(newGuid, newIdentity);
		this.registeredNicks.set(nick.toLowerCase(), newGuid);
		this.saveUsers();
		return newIdentity;
		}
	}

	public setColor(guid: string, color: SafeString): Identity{
		const user = this.users.get(guid)!;
		user.nick = color.toUpperCase() + user.nick.substring(7)
		user.lastChanged = new Date();
		this.saveUsers();
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

	public setStatus(guid: string, status: SafeString): Identity {
		const user = this.users.get(guid);

		if(!user){
			throw new Error('No matching user found to GUID');
		}

		if(user.status === status){
			throw new Error('already your status big dog');
		}

		user.status = status;
		user.lastChanged = new Date();
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
		if(user.isAfk){
			user.isAfk = false;
		}
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
	

	public deleteUser(guid: string){
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
		} 
		catch (e: any) {
			console.error('Failed to load user data', `${e.message}`);
		}
	}

	private saveUsers() {
		try {
			const dir = dirname(this.deps.usersPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, {recursive: true});
			}

			const data = Array.from(this.users.entries());
			writeFileSync(this.deps.usersPath, JSON.stringify(data, null, 4));
		} 
		catch (e: any) {
			console.error('failed to save user data', `${e.message}`);
		}
	}
}