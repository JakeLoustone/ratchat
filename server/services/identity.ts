import { v4 as uuidv4 } from 'uuid';
import type { Identity } from '../../shared/types.ts'
import * as fs from 'fs';
import * as path from 'path';


export class IdentityService {
	private users: Map<string, Identity> = new Map();
	private registeredNicks: Map<string, string> = new Map();
	private userList: string;
	private badNicks: RegExp[] = []

	constructor(storagePath: string) {
		this.userList = storagePath;
		this.loadFilters();
		this.loadData();
	}

	public setNick(guid: string | null, nick: string): Identity{
		//Nick santization and validation
		const sanitizeNick = nick.replace(/[^\w\s]/gi, '').trim();
		
		if (this.badNicks.some(regex => regex.test(sanitizeNick))) {
			throw new Error(`can't be named that`);
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

			const changeOk = new Date(user.lastChanged).getTime() + (30 * 1000);
			const now = Date.now();
			if(now < changeOk){
				const waitTime = (changeOk- now)/1000;
				throw new Error(`you're doing that too fast, wait ${Math.ceil(waitTime)} seconds.`);
			}
			this.registeredNicks.delete(oldNick.toLowerCase());
			this.registeredNicks.set(sanitizeNick.toLowerCase(), guid);

			const color = user.nick.substring(0,7)
			user.nick = color + sanitizeNick;
			user.lastChanged = new Date(now);
			this.saveData();
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
		this.saveData();
		return newIdentity;
		}
	}

	public setColor(guid: string, color: string): Identity{
		const user = this.users.get(guid)!;
		const validColor = (color && /^#[0-9A-F]{6}$/i.test(color));
		if (!validColor) {
			throw new Error('invalid hex code. please use format #RRGGBB');
		}

		const changeOk = new Date(user.lastChanged).getTime() + (5 * 1000);
		const now = Date.now();

		if(now < changeOk){
			const waitTime = (changeOk- now)/1000;
			throw new Error(`you're doing that too fast, wait ${Math.ceil(waitTime)} seconds.`);
		}

		user.nick = color.toUpperCase() + user.nick.substring(7)
		user.lastChanged = new Date(now);
		this.saveData();
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
			this.saveData();
		}
		else{
			user.isAfk = true;
			this.saveData();
		}
		return user;
	}

	public setStatus(guid: string, status: string): Identity {
		const user = this.users.get(guid);
		const newStatus = status;
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		user.status = newStatus;
		this.saveData();
		return user;
	}

	public setLastMessage(guid: string, msgdate: number): Identity {
		const user = this.users.get(guid);
		const newDate = msgdate;
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		user.lastMessage = new Date(newDate);
		this.saveData();
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
		this.saveData();
		console.log(`GDPR: Deleted user ${cleanNick} (${guid})`);
	}


	public nickAvailable(nick: string): boolean {
		const clean = nick.replace(/[^\w\s]/gi, '').trim();
		return !this.registeredNicks.has(clean.toLowerCase());
	}

	private loadFilters() {
		try {
			const nickFilter = JSON.parse(fs.readFileSync('./nickfilter.json', 'utf-8')).usernames || [];
			const profList = JSON.parse(fs.readFileSync('./profanityfilter.json', 'utf-8'));
			const profFilter = Array.isArray(profList) 
				? profList
					.filter((item: any) => item.tags?.includes('racial') && item.severity > 2)
					.map((item: any) => item.match) // Extract the string to compare against
				: [];
			const configFilter = JSON.parse(fs.readFileSync('./config.json', 'utf-8')).nickres || [];
			const regFilter = [...nickFilter, ...profFilter, ...configFilter].filter(Boolean);

			this.badNicks = regFilter.map(pattern => new RegExp(pattern, 'i'));
		} catch (e) {
			console.error('nick filter load issue');
			this.badNicks = [];
		}
    }
	
	private loadData() {
		try {
			if (!fs.existsSync(this.userList)) {
			return;
			}

			const data = fs.readFileSync(this.userList, 'utf-8');
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
	}

	private saveData() {
		try {
			const dir = path.dirname(this.userList);
			if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, {recursive: true});
			}

			const data = Array.from(this.users.entries());
			fs.writeFileSync(this.userList, JSON.stringify(data, null, 4));
		} catch (e: any) {
			console.error('failed to save user data', `${e.message}`);
		}
	}
}