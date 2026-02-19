import { v4 as uuidv4 } from 'uuid';
import type { Identity } from '../../shared/types.ts'
import * as fs from 'fs';
import * as path from 'path';


export class IdentityService {
    private users: Map<string, Identity> = new Map();
    private registeredNicks: Map<string, string> = new Map();
    private userList: string;

    constructor(storagePath: string) {
	this.userList = storagePath;
	this.loadData();
    }

    public userResolve(guid: string | null, nick: string, color?: string): Identity{
	const sanitizeNick = nick.replace(/[^\w\s]/gi,  '').trim();

	const validColor = ( color && /^#[0-9A-F]{6}$/i.test(color));

	if (color && !validColor) {
	    throw new Error('invalid hex code. please use format #RRGGBB');
	}

	if (sanitizeNick.length < 2 || sanitizeNick.length > 15) {
	    throw new Error('nickname must be between 2 and 15 characters')
	}


	//Returning user check
	if (guid && this.users.has(guid)) {
	    const user = this.users.get(guid)!;
	    const oldNick = user.nick.substring(7);
	    // Changing nickname check
	    if(sanitizeNick !== oldNick) {
		if (this.registeredNicks.has(sanitizeNick)) {
		    throw new Error('nickname is already in use');
		}

		this.registeredNicks.delete(oldNick);
		this.registeredNicks.set(sanitizeNick, guid);
		}
		const oldColor = user.nick.substring(0,7)

		const newColor = validColor ? color! : oldColor;
		user.nick = newColor + sanitizeNick;
		this.saveData();
		return user;
	}
	if (this.registeredNicks.has(sanitizeNick)) {
	    throw new Error('nickname is already in use');
	}

	const newGuid = guid || uuidv4();
	const newIdentity: Identity = {
	    guid: newGuid,
	    nick: (color || '#000000') + sanitizeNick,
	    status: 'online',
	    isMod: false,
	    lastMessage: new Date(0),
		isAfk: false
	};
	
	this.users.set(newGuid, newIdentity);
	this.registeredNicks.set(sanitizeNick, newGuid);
	this.saveData();
	return newIdentity;
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

	public deleteUser(guid: string): void {
		const user = this.users.get(guid);
		if(!user){
			throw new Error('No matching user found to GUID')
		}
		const cleanNick = user.nick.substring(7);
		this.registeredNicks.delete(cleanNick);
		this.users.delete(guid);
		this.saveData();
		console.log(`GDPR: Deleted user ${cleanNick} (${guid})`);
	}


    public nickAvailable(nick: string): boolean {
		const clean = nick.replace(/[^\w\s]/gi, '').trim();
		return !this.registeredNicks.has(clean);
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
		this.registeredNicks.set(existingNick, guid);
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



