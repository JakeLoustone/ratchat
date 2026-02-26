import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';

import type { Identity } from '../shared/schema.ts';
import { mType } from '../shared/schema.ts';

import { IdentityService } from './services/identity.ts'
import { CommandService } from './services/command.ts';
import { ModerationService } from './services/moderation.ts';	
import { StateService } from './services/state.ts';
import { MessageService } from './services/message.ts';

//TODO: ip hashing
//TODO: socket protection
//TODO: ban enforcement

const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {connectionStateRecovery:{}});
const __dirname = dirname(fileURLToPath(import.meta.url));
const usersPath = join(__dirname, 'data', 'users.json');
const configPath = join(__dirname, 'config.json');

const messageService = new MessageService({

});

const stateService = new StateService({
	messageService: messageService,

	configPath: configPath,
}); 

const moderationService = new ModerationService({
	stateService: stateService, 
});

const identityService = new IdentityService({
	moderationService: moderationService,
	
	usersPath: usersPath,
});

const commandService = new CommandService({
	messageService: messageService,
	stateService: stateService,
	moderationService: moderationService,
	identityService: identityService
});

//CONNECTION POINT

io.on('connection', (socket) => {
	console.log('a user connected')

	//On connection welcome, announcement messages, emote payload, message history
	const welcomeMsg = stateService.getConfig().welcomeMsg;
	const announcement = stateService.getAnnouncement();
	const emotes = stateService.getEmotes();
	
	messageService.sendSys(socket, mType.welcome, `${welcomeMsg}`)
	if (announcement){
		messageService.sendSys(socket, mType.ann, `announcement: ${announcement}`)
	}
	if(emotes.size > 0){
		const emotePayload = Object.fromEntries(emotes);
		messageService.send(socket, mType.emote, emotePayload);
	}
	for (const [id, msg] of messageService.getChatHistory()){
		messageService.send(socket, mType.chat, msg)
	}

	//Identity Service
	const clientGUID = socket.handshake.auth.token;
	let returningUser: Identity | null = null;
	
	try{
		returningUser = identityService.getUser(clientGUID)
	} catch (error: any){
		console.warn(`${error.message}`);
	}

	if (returningUser) {
		stateService.updateSocketUser(io, socket.id, returningUser);
		messageService.send(socket, mType.identity, returningUser);
		messageService.sendSys(socket, mType.info, `welcome back, ${returningUser.nick.substring(7)}`);
		messageService.sendSys(io,mType.ann,`${returningUser.nick.substring(7)} connected`);
	} 
	else {
		messageService.sendSys(socket,mType.error,"system: please use the /nick <nickname> to set a nickname or /import <GUID> to import one");
		//GDPR warning
		messageService.sendSys(socket,mType.error,"system: be aware either command will store data regarding your session. type '/gdpr info' for more info");
		//force broadcastUsers for lurkers check
		stateService.broadcastUsers(io);
	}

	//Message Handling
	socket.on('toServerChat', async (msg, callback) => {
		const user = stateService.getSocketUsers().get(socket.id);

		// Check if it's a command
		if (msg.startsWith('/')) {
			const args = msg.slice(1).trim().split(/ +/);
			const commandName = args.shift()?.toLowerCase() || '';

			let commandUser: Identity | null = null;
			try {
				commandUser = identityService.getUser(socket.handshake.auth.token);
			} catch {
			}

			const success = await commandService.execute(commandName, {
				socket,
				io,
				args,
				fullArgs: args.join(' '),
				commandUser: user || commandUser
			});

			if(success && typeof callback === 'function'){
				callback();
			}

			return;
		}

		//Prevent users from chatting without an identity
		if (!user) {
			messageService.sendSys(socket, mType.error, "system: please set your nickname with /chrat <nickname> before chatting");
			if (typeof callback === 'function') callback();
			return;
		}

		try{
			const safe = moderationService.textCheck(msg, user, 'chat');
			console.log('message: ', safe)
			messageService.sendChat(io, user, safe, stateService.getConfig().msgArrayLen);
			try{
				identityService.setLastMessage(user.guid, Date.now());
			} catch (e: any){
				console.warn(`${e.message}`);
				throw new Error(e.message);
			}
			if (typeof callback === 'function') {
				callback();
			}
		}
		catch(e: any){
			messageService.sendSys(socket, mType.error, `system: ${e.message}`)
			return;
		}
	});

	//Disconnect flow
	socket.on('disconnect', () => {
		console.log('a user disconnected');
		const disuser = stateService.getSocketUsers().get(socket.id);

		if(disuser){
			stateService.deleteSocketUser(io, socket.id);
			messageService.sendSys(io, mType.ann, `${disuser.nick.substring(7)} disconnected`);
		}
		else{
			//lurker disconnect
			stateService.broadcastUsers(io);
		}
	});
});

//Client Deployment
app.get('/ratchat', (req, res) => {
	res.setHeader('X-Robots-Tag', 'noindex, nofollow');
	res.sendFile('www/ratchat.html', { root : __dirname });
});

//Server standup
httpserver.listen(stateService.getConfig().PORT, () => {
	console.log(`server running at http://localhost:${stateService.getConfig().PORT}`);
});

//Fetch emotes on startup
try{
	await stateService.updateEmotes(io)
	console.log('startup emotes loaded');
}
catch(e: any){
	console.warn(`startup emotes failed: ${e.message}`);
};