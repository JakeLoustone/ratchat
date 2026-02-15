import { v4 as uuidv4 } from 'uuid';
import { Identity } from './shared/type.ts'

export class IdentityService {
    private users: Map<string, Identity> = new Map();
    private cachedNicks: Set<string> = new Set();

    private RESERVED_NICK = placeholder.import


    public userResolve(socketid: string, payload: { guid?: string, nick?: string }): Identity {

	let actualNick = this.sanitizeNickname(payload.nick)

