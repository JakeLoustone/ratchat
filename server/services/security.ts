import { Server } from "socket.io";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from 'path';
import crypto from 'crypto';

import type { Identity } from "../../shared/schema.ts";
import { mType } from "../../shared/schema.ts";

import { StateService } from "./state.ts";
import { MessageService } from "./message.ts";
import { IdentityService } from "./identity.ts";

export interface SecurityServiceDependencies{
	stateService: StateService;
	messageService: MessageService;
	identityService: IdentityService;
	
	bansPath: string;
	io: Server;
}

export class SecurityService{
	private bans: Map<string, Date> = new Map();
	private deps: SecurityServiceDependencies;

	constructor(dependencies: SecurityServiceDependencies){
		this.deps = dependencies;
		
		this.loadBans();
	}
	
	public checkBan(unhashed: string): boolean {
		try{
			const hash = this.hashIP(unhashed);
			if(this.bans.has(hash)){
				return true;
			}
			else{
				return false;
			}
		}
		catch(e: any){
			throw new Error (e.message);
		}
	}

	public banUser(banUser: Identity){
		const socketUsers = this.deps.stateService.getSocketUsers();
		let socketIDs = [] as string[]

		socketUsers.forEach((user, id) => {
			if(user.guid === banUser.guid){
				socketIDs.push(id)
			}
		})

		if(socketIDs.length === 0){
			throw new Error ("couldn't find any connections from that user")
		}

		socketIDs.forEach((sid) => {
			const socket = this.deps.io.sockets.sockets.get(sid);
			const sentinelId = { guid: 'RESET_IDENTITY' } as Identity;
			if(socket){
				try{
					const banIP = this.hashIP(socket?.handshake.address);
					this.bans.set(banIP, new Date());

					this.deps.messageService.send(socket, mType.identity, sentinelId);
					this.deps.messageService.sendSys(socket, mType.error, 'You have been banned.');
					this.deps.stateService.deleteSocketUser(this.deps.io, sid);
					socket.disconnect(true);
				}
				catch(e: any){
					console.warn('HASH ERROR:', e.message);
					throw new Error(e.message);
				}
			}
			else{
				throw new Error("couldn't get sockets for user");
			}
		});

		this.deps.identityService.deleteUser(banUser.guid);
		this.saveBans();
	}

	private hashIP(ip: string): string{
		if(!process.env.IP_PEPPER){
			throw new Error ('no pepper set')
		}
		const pepper = process.env.IP_PEPPER
		const hash = crypto.createHash('sha256')
		hash.update(ip + pepper);
		return hash.digest('hex');
	}

	private loadBans() {
	try {
		if (!existsSync(this.deps.bansPath)) {
			return;
		}

		const data = readFileSync(this.deps.bansPath, 'utf-8');
		const parseData: [string, Date][] = JSON.parse(data);

		this.bans = new Map(parseData);

		console.log(`loaded ${this.bans.size} bans`);
	} 
	catch (e: any) {
		console.error('Failed to load ban data', `${e.message}`);
	}
	}

	private saveBans() {
		try {
			const dir = dirname(this.deps.bansPath);
			if (!existsSync(dir)) {
				mkdirSync(dir, {recursive: true});
			}

			const data = Array.from(this.bans.entries());
			writeFileSync(this.deps.bansPath, JSON.stringify(data, null, 4));
		} catch (e: any) {
			console.error('failed to save user data', `${e.message}`);
		}
	};
}