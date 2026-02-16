import { v4 as uuidv4 } from 'uuid';
import { Identity } from '../../shared/types.ts'

export class IdentityService {
    private users: Map<string, Identity> = new Map();
    private registeredNicks: Map<string, string> = new Map();

    public userResolve(guid: string | null, nick: string, color?: string): Identity{
	const sanitizeNick = nick.replace(/[^\w\s]/gi,  '').trim();

	const colorSelect = (color && /^#[0-9A-F]{6}$/i.test(color))
            ? color
            : '#000000';

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

		const color = user.nick.substring(0,7);
		user.nick = color + sanitizeNick;
		return user;
	}
	if (this.registeredNicks.has(sanitizeNick)) {
	    throw new Error('nickname is already in use');
	}

	const newGuid = guid || uuidv4();
	const newIdentity: Identity = {
	    guid: newGuid,
	    nick: colorSelect + sanitizeNick,
	    status: 'online',
	    isMod: false,
	    lastMessage: new Date(0)
	};

	this.users.set(newGuid, newIdentity);
	this.registeredNicks.set(sanitizeNick, newGuid);

	return newIdentity;
    }

    public getUser(guid: string): Identity | undefined {
	return this.users.get(guid);
    }

    public nickAvailable(nick: string): boolean {
	const clean = nick.replace(/[^\w\s]/gi, '').trim();
	return !this.registeredNicks.has(clean);
    }
}


