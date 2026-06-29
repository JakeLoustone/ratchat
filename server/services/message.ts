import { Server, Socket } from 'socket.io';

import { mType, Identity } from '../../shared/schema';

import { DispatchService } from './dispatch';
import { StateService } from './state';
import { ModerationService } from './moderation';
import { IdentityService } from './identity';
import { MarkovService } from './markov';

const clearInput: boolean = true;
const keepInput: boolean = false;

export interface MessageServiceDependencies {
	dispatchService: DispatchService;
	stateService: StateService;
	moderationService: ModerationService;
	identityService: IdentityService;
	markovService: MarkovService | null;

	io: Server;
}

export class MessageService {
	private deps: MessageServiceDependencies;
	constructor(dependencies: MessageServiceDependencies){
		this.deps = dependencies;
	}

	public handleChat(msg: string, user: Identity, socket: Socket, spoiler: boolean): boolean{
		let safe = ''
		try{
			safe = this.deps.moderationService.textCheck(msg, user, 'chat');
			this.deps.dispatchService.sendChat(this.deps.io, user, safe, this.deps.stateService.getServerConfig().msgArrayLen, spoiler);			
		}
		catch(error: unknown){
			if(error instanceof Error){
				this.deps.dispatchService.sendSystemChat(socket, mType.error, `system: ${error.message}`)
				return keepInput;
			} 
			else{
				console.error("Unexpected non-error thrown:", error);
				this.deps.dispatchService.sendSystemChat(socket, mType.error, 'system: unexpected error. try again')
				return keepInput;
			}
		}
		try{
			const wasAfk = user.isAfk;
			this.deps.identityService.setLastMessage(user.guid, Date.now());
			if(wasAfk){
				this.deps.stateService.broadcastUsers(this.deps.io);
			}
		} 
		catch(error: unknown){
			if(error instanceof Error){
				console.warn(error.message);
			} 
			else{
				console.error("Unexpected non-error thrown:", error);
			}
		}
		if(this.deps.markovService && this.deps.stateService.getMarkovConfig().learning){
			queueMicrotask(() => {
				try{
					if(safe){
						this.deps.markovService!.markovLearn(safe)
					}
				}
				catch(error: unknown){
					if(error instanceof Error){
						console.warn('markov learning error:', error.message);
					}
					else{
						console.error("Unexpected non-error thrown:", error);
					}
				}	
			});
		}
		return clearInput;
	}
}