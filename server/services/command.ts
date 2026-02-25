import type { Server, Socket } from 'socket.io';

import type { Command, Identity, ChatMessage } from '../../shared/schema.ts';
import { tType, mType } from '../../shared/schema.ts';

import { MessageService } from './message.ts';
import { StateService } from './state.ts';
import { ModerationService } from './moderation.ts';
import { IdentityService } from '../services/identity.ts';


export interface CommandServiceDependencies {
	messageService: MessageService;
	stateService: StateService;
	moderationService: ModerationService;
	identityService: IdentityService;
}

export class CommandService {
	private commands: Record<string, (ctx: Command) => boolean | Promise<boolean>> = {};
	private deps: CommandServiceDependencies;

	constructor(dependencies: CommandServiceDependencies) {
		this.deps = dependencies;
		this.registerCommands();
	}

	//execute the command, true to clear 
	public async execute(name: string, ctx: Command): Promise<boolean> {
		const handler = this.commands[name];
		if (handler) {
			//true to clear input, false to keep
			return await handler(ctx);
		} else {
			this.deps.messageService.sendSys(ctx.socket, mType.error, "system: that's not a command lol");
			return false;
		}
	}

	private registerCommands() {
		
		// ------------------------------------------------------------------
		// STANDARD COMMANDS
		// ------------------------------------------------------------------
		
		this.commands['help'] = (ctx) => {

			const helpMessages = [
				'/help, /h, or /commands : View this list.',
				'/chrat or /nick <nickname> : Change your nickname to <nickname>.',
				"/color or /colour <#RRGGBB> : Change your nickname's color to hex #RRGGBB.",
				//./clear and /clr are handled client side
				'/clear or /clr : removes all visible messsages on your screen. (others can still see them)',
				//./export is handled client side
				"/export : returns your GUID for later importing on other devices. if you like your name don't share it :)",
				'/import : import a GUID exported earlier to reclaim your nickname. must match exactly!',
				'/afk : toggle AFK status in the user listing',
				'/status or /me : set your status in the user listing',
				'/background or /bg : set your background image. use /bgreset to clear',
				'/gdpr <flag> : <info> for more information, <export> for a copy of your data, and <delete> to wipe your data.'
			];

			if (ctx.commandUser?.isMod) {
				helpMessages.push(
					'',
					'--- Moderator Commands ---',
					'/announce or /announcement <text> : Send an announcement to all users.',
					'/ban <user> : Permanently bans a user with nickname "user"',
					'/timeout or /to <user> : Mutes nickname "user" for 5 min.',
					'/delete <1> : Delete a message with ID 1.',
					'/emotes <emotesetID> : adds an emote set from 7tv. leave blank to reload from config'
				);
			}

			const formatTable = helpMessages.join('\n');
			this.deps.messageService.sendSys(ctx.socket, mType.info, formatTable);
			return true;
		};

		this.commands['nick'] = (ctx) => {
			if(ctx.commandUser){
				try{
					this.deps.moderationService.timeCheck(ctx.commandUser, tType.nick);
				}
				catch(e: any){
					this.deps.messageService.sendSys(ctx.socket, mType.error, `${e.message}`)
					return false;
				}
			}

			if (ctx.args.length > 1){
				this.deps.messageService.sendSys(ctx.socket, mType.error, 'system: no spaces in usernames');
				return false;
			}

			const newNick = ctx.args[0];

			if (!newNick || newNick.length < 2 || newNick.length > 16) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, 'system: please provide a username with at least 2 but less than 15 characters');
				return false;
			}
			
			try {
				// If they have no commandUser, extract the GUID from the handshake token directly
				const guid = ctx.commandUser?.guid || ctx.socket.handshake.auth.token;
				const oldNick = ctx.commandUser?.nick;
				const updatedUser = this.deps.identityService.setNick(guid, newNick);

				this.deps.stateService.updateSocketUser(ctx.io, ctx.socket.id, updatedUser);
				this.deps.messageService.send(ctx.socket, mType.identity, updatedUser);
				
				if (oldNick) {
					this.deps.messageService.sendSys(ctx.io, mType.ann, `${oldNick.substring(7)} changed their username to ${updatedUser.nick.substring(7)}`);
				} 
				else {
					this.deps.messageService.sendSys(ctx.io, mType.ann, `${updatedUser.nick.substring(7)} has joined teh ratchat`);
				}
				return true;
			} catch (e: any) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
				return false;
			}
		};

		this.commands['color'] = (ctx) => {
			if (!ctx.commandUser){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "system: please use /chrat <nickname> before trying to set a color");
				return true;
			}
			if(ctx.commandUser){
				try{
					this.deps.moderationService.timeCheck(ctx.commandUser, tType.other);
				}
				catch(e: any){
					this.deps.messageService.sendSys(ctx.socket, mType.error, `${e.message}`)
					return false;
				}
			}
			
			const hex = ctx.args[0];			
			try {
				const trimNick = ctx.commandUser.nick.substring(7);
				const updatedUser = this.deps.identityService.setColor(ctx.commandUser.guid, hex);

				this.deps.stateService.updateSocketUser(ctx.io, ctx.socket.id, updatedUser,);
				this.deps.messageService.send(ctx.socket, mType.identity, updatedUser);
				this.deps.messageService.sendSys(ctx.socket, mType.info, `system: your color has been updated to ${hex}`);

				return true;
			} catch (e: any) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
				return false;
			}
		};
		
		//anti-canadian trap
		this.commands['colour'] = (ctx) => {
			this.deps.messageService.sendSys(ctx.socket, mType.error, "system: lern to speak american");
			return false;
		}

		this.commands['import'] = (ctx) => {
			//check arg is legitimate GUID
			const newGUID = ctx.args[0];
			const GUIDregex = new RegExp("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$");
			if (!GUIDregex.test(newGUID)) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, "system: not a valid GUID");
				return false;
			}

			try {
				const updatedUser = this.deps.identityService.getUser(newGUID);

				this.deps.stateService.updateSocketUser(ctx.io, ctx.socket.id, updatedUser);
				this.deps.messageService.send(ctx.socket, mType.identity, updatedUser);
				this.deps.messageService.sendSys(ctx.socket, mType.info, `system: identity changed to ${updatedUser.nick.substring(7)}`);
				
				//if existing user show them disconnecting
				if (ctx.commandUser) {
					this.deps.messageService.sendSys(ctx.io, mType.ann, `${ctx.commandUser.nick.substring(7)} disconnected`);
				}

				this.deps.messageService.sendSys(ctx.io, mType.ann, `${updatedUser.nick.substring(7)} connected`);
				
				return true;
			} catch (e: any) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
				return false;
			}
		};

		this.commands['afk'] = (ctx) => {
			if (!ctx.commandUser){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "system: please use /chrat <nickname> before trying to go afk lmao");
				return true;
			} 
			if(ctx.commandUser){
				try{
					this.deps.moderationService.timeCheck(ctx.commandUser, tType.other);
				}
				catch(e: any){
					this.deps.messageService.sendSys(ctx.socket, mType.error, `${e.message}`)
					return false;
				}
			}
			
			try {
				const afkUser = this.deps.identityService.toggleAfk(ctx.commandUser.guid);

				this.deps.stateService.updateSocketUser(ctx.io, ctx.socket.id, afkUser);
				this.deps.messageService.sendSys(ctx.socket, mType.info, afkUser.isAfk ? "you've gone afk" : `welcome back, ${afkUser.nick.substring(7)}`);

				return true;
			} catch (e: any) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
				return false;
			}
		};

		this.commands['status'] = (ctx) => {
			if (!ctx.commandUser){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "system: please use /chrat <nickname> before trying to facebook post");
				return true;
			}
			if(ctx.commandUser){
				try{
					this.deps.moderationService.timeCheck(ctx.commandUser, tType.other);
				}
				catch(e: any){
					this.deps.messageService.sendSys(ctx.socket, mType.error, `${e.message}`)
					return false;
				}
			}

			//Sanitize
			const noHtml = ctx.fullArgs.replace(/<[^>]*>?/gm, '');
			const newStatus = noHtml.replace(/[^\x20-\x7E]/g, '');
			
			if (newStatus.length > 32){
				this.deps.messageService.sendSys(ctx.socket, mType.error, 'system: tl;dr - set something shorter');
				return false;
			}
			
			try {
				const updatedUser = this.deps.identityService.setStatus(ctx.commandUser.guid, newStatus);

				this.deps.stateService.updateSocketUser(ctx.io, ctx.socket.id, updatedUser);
				this.deps.messageService.sendSys(ctx.socket, mType.info, `your status is now: ${updatedUser.status}`);
				
				return true;
			} catch (e: any) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
				return false;
			}
		};

		this.commands['gdpr'] = (ctx) => {
			const subComm = ctx.args[0];
			switch (subComm) {
				case 'info':
					const infoMsgs = [
						'---------------------------------------------------------------------------------------------',
						'We store the following data server side:',
						'guid			|	Unique identifier and allows multiple sessions to have the same nickname',
						'nick			|	Chosen nickname and color set by the /nick and /color commands',
						'lastChanged	|	Timestamp of when nickname was last changed to prevent nick abuse',
						'status			|	Chosen status displayed in user listing set by /status command',
						'isMod			|	Flag for allowing moderator actions',
						'lastMessage	|	Timestamp of last message sent for timeout enforcement and nickname cleanup',
						'isAfk			|	AFK flag for user listing set by /afk command',
						'---------------------------------------------------------------------------------------------',
						'We store the following information locally:',
						'ratGUID		|	a local copy of the GUID for message construction',
						'ratBG			|	a local version of image selected for background image (not sent to server)',
						'---------------------------------------------------------------------------------------------',
						'Use /gdpr info to see this message again',
						'Use /gdpr ip to see specific information on how and why we use IP addresses',
						'Use /gdpr export to see a copy of your data stored on the server, if any.',
						'Use /gdpr delete to permanently remove your data from the server. this will prevent you from utilizing the application.',
						'---------------------------------------------------------------------------------------------',
					];
					const formatTable = infoMsgs.join('\n');
					this.deps.messageService.sendSys(ctx.socket, mType.info, formatTable);
					return true;
				case 'ip':
					const ipMsgs = [
						'---------------------------------------------------------------------------------------------',
						'We utilize IP addresses for ban enforcement and system protection as allowed under Article 6(1)(f) of the GDPR.',
						'These IP addresses are only stored long term in the event of a ban from bad behavior.',
						'An IP address is stored only with a timestamp. This timestamp is to allow a review process to reverse bans after an amount of time.',
						'If an IP address is stored, it is rendered human unreadable by a one way salted cryptography hash. A "plain-text" IP address is never stored.',
						'Any time a user connects, their IP is hashed in the same way and compared to the stored bans.',
						'An IP address is only linked to a user at the instant of banning in order to select the correct IP to ban. This linkage is not stored.',
						'---------------------------------------------------------------------------------------------'
					];
					const formatIpTable = ipMsgs.join('\n');
					this.deps.messageService.sendSys(ctx.socket, mType.info, formatIpTable);
					return true;

				case 'export':
					if (!ctx.commandUser){
						this.deps.messageService.sendSys(ctx.socket, mType.error, "system: no server stored data");
						return true;
					}

					this.deps.messageService.sendSys(ctx.socket, mType.info, `Server stored info: ${JSON.stringify(ctx.commandUser, null, 4)}`);
					return true;

				case 'delete':
					if (!ctx.commandUser){
						this.deps.messageService.sendSys(ctx.socket, mType.error, "system: no server stored data");
						return true;
					}

					try {
						const targetGuid = ctx.commandUser.guid;
						const targetNick = ctx.commandUser.nick;
				
						// Local deletion ID
						const sentinelId = { guid: 'RESET_IDENTITY' } as Identity;
						
						//iterate through all sockets to find matches
						const allSockets = ctx.io.sockets.sockets;
						allSockets.forEach((socket) => {
							const mappedUser = this.deps.stateService.getSocketUsers().get(socket.id);
							if(mappedUser && mappedUser.guid === targetGuid){
								this.deps.messageService.send(socket, mType.identity, sentinelId);
								this.deps.stateService.updateSocketUser(ctx.io, socket.id, ctx.commandUser!);
								this.deps.messageService.sendSys(socket, mType.info, 'goodbye is ur data');
							}

						});

						this.deps.identityService.deleteUser(targetGuid);
						this.deps.messageService.sendSys(ctx.io, mType.ann, `${targetNick.substring(7)} disconnected`);
						return true;

					} catch (e: any) {
						this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
						return false;
					}

				default:
					this.deps.messageService.sendSys(ctx.socket, mType.error, "system: please use with 'info', 'ip', 'export' or 'delete' after /gdpr");
					return false;
			}
		};

		// ------------------------------------------------------------------
		// MODERATOR COMMANDS
		// ------------------------------------------------------------------

		this.commands['announce'] = (ctx) => {
			if (!ctx.commandUser?.isMod){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "naughty naughty");
				return true;
			}
			if(ctx.commandUser){
				try{
					this.deps.moderationService.timeCheck(ctx.commandUser, tType.chat);
				}
				catch(e: any){
					this.deps.messageService.sendSys(ctx.socket, mType.error, `${e.message}`)
					return false;
				}
			}

			//Sanitize
			const noHtml = ctx.fullArgs.replace(/<[^>]*>?/gm, '');
			const newAnnounce = noHtml.replace(/[^\x20-\x7E]/g, '');

			if (newAnnounce.trim().length > 0) {
				try{
					this.deps.stateService.setAnnouncement(ctx.io, newAnnounce);
					return true;
				}
				catch(e: any){
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`)
				return false;
				}
			}	
			else {
				// Clear announcement
				try{
					this.deps.stateService.setAnnouncement(ctx.io, '');
					this.deps.messageService.sendSys(ctx.socket, mType.info, 'announcement cleared');
					return true;
				}
				catch(e: any){
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`)
				return false;
				}
			}
		};
		 
		this.commands['ban'] = (ctx) => {
			if (!ctx.commandUser?.isMod){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "naughty naughty");
				return true;
			}
			if (!ctx.args[0]){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "missing target");
				return false;
			}

			this.deps.messageService.sendSys(ctx.io, mType.info, `${ctx.fullArgs} has been banned.`);
			return true;
		};

		this.commands['timeout'] = (ctx) => {
			if (!ctx.commandUser?.isMod){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "naughty naughty");
				return true;
			}
			if (!ctx.args[0]){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "missing target");
				return false;
			}

			const targetNick = ctx.args[0]
			try{
				const targetUser = this.deps.identityService.getUserByNick(targetNick)
				
				//set duration in seconds
				const durationInput = parseInt(ctx.args[1]);
				const duration = isNaN(durationInput) || durationInput <0 ? 300 : durationInput;
				const now = Date.now();

				//apply the timeout to the future
				const unMute = now + (duration * 1000);
				this.deps.identityService.setLastMessage(targetUser.guid, unMute);

				//messages to delete
				const msgArray: number[] = []
				for (const [id, msg] of this.deps.messageService.getChatHistory()){
					const msgNick = msg.author.substring(7);
					if(msgNick === targetNick){
						msgArray.push(id);
					}
				}

				//delete messages if any
				if (msgArray.length > 0){
					this.deps.messageService.deleteMessage(ctx.io, msgArray);
				}

				this.deps.messageService.sendSys(ctx.io, mType.info, `${targetNick} has been timed out.`);
				return true;
			} catch(e: any){
				this.deps.messageService.sendSys(ctx.socket, mType.error, `${e.message}`);
				return false; 
			}
		};

		this.commands['delete'] = (ctx) => {
			if (!ctx.commandUser?.isMod){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "naughty naughty");
				return true;
			}

			if (!ctx.args[0] || isNaN(Number(ctx.args[0]))){
				this.deps.messageService.sendSys(ctx.socket, mType.error, "please provide message id");
				return false;
			} 

			const delArray : number[] = [];
			delArray.push(Number(ctx.args[0]));

			this.deps.messageService.deleteMessage(ctx.io,delArray);

			return true;
		};

		this.commands['emotes'] = async (ctx) => {
			if (!ctx.commandUser?.isMod) {
				this.deps.messageService.sendSys(ctx.socket, mType.error, "naughty naughty");
			return true;
			}

			let targetUrl = ctx.args[0];

			if(targetUrl){
				const isValidId = /^[a-z0-9_-]+$/i.test(targetUrl);
				if (!isValidId) {
					this.deps.messageService.sendSys(ctx.socket, mType.error, "doesn't look like a 7tv ID");
					return false;
				}
				this.deps.messageService.sendSys(ctx.socket, mType.info, `fetching new emote set ${targetUrl}...`);
			}
			else{
				this.deps.messageService.sendSys(ctx.socket, mType.info, 'reloading emotes from config...');
			}

			try{
				await this.deps.stateService.updateEmotes(ctx.io, targetUrl);
				this.deps.messageService.sendSys(ctx.socket, mType.info, 'emotes loaded');
				return true;
			} catch(e: any){
				this.deps.messageService.sendSys(ctx.socket, mType.error, `system: ${e.message}`);
				return false;
			}
		};

		// ------------------------------------------------------------------
		// ALIASES
		// ------------------------------------------------------------------

		this.commands['h'] = this.commands['commands'] = this.commands['help'];
		this.commands['chrat'] = this.commands['nickname'] = this.commands['name'] = this.commands['nick'];
		this.commands['me'] = this.commands['status'];
		this.commands['to'] = this.commands['timeout'];
		this.commands['announcement'] = this.commands['announce'];
		this.commands['emote'] = this.commands ['emotes'];
	}
}