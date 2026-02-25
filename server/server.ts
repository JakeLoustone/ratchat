import { Server, Socket} from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';

import type { Identity, ChatMessage, MessageType, ServerConfig } from '../shared/types.ts';
import { tType, mType } from '../shared/types.ts';

import { IdentityService } from './services/identity.ts'
import { CommandService } from './services/command.ts';
import { ModerationService } from './services/moderation.ts';	
import { ConfigService } from './services/config.ts';

//TODO: ip hashing
//TODO: socket protection
//TODO: ban enforcement

const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {connectionStateRecovery:{}});
const __dirname = dirname(fileURLToPath(import.meta.url));
const usersPath = join(__dirname, 'data', 'users.json');
const configPath = join(__dirname, 'config.json');


const config = {} as ServerConfig;
const emotes = new Map<string, string>();
const socketUsers = new Map<string, Identity>();
const chatHistory = new Map<number, ChatMessage>();
let announcement = '';


const configService = new ConfigService({
	configPath: configPath,
	config: config,
	emotes: emotes,

	send: send
}); 

const moderationService = new ModerationService({ 
	config: config,
	
	send: send
});

const identityService = new IdentityService({
	moderationService: moderationService,
	
	usersPath: usersPath,
	config: config
});

const commandService = new CommandService({
	configService: configService,
	identityService: identityService,
	moderationService: moderationService,
	
	send: send,
	sendSys: sendSys,
	updateSocketUser: updateSocketUser,
	setAnnouncement: (text: string) => { announcement = text; },
	
	config: config,
	chatHistory: chatHistory,
	socketUsers: socketUsers
});


let messageCounter = {val: 0};

var uList: UserSum[] = [];

type UserSum = Pick<Identity, "nick" | "status" | "isAfk">
type Target = Server | Socket;
type TextPayload = typeof mType.chat | typeof mType.ann | typeof mType.error | typeof mType.info | typeof mType.welcome;
type MessagePayloadMap = {
[T in MessageType]: 
	T extends typeof mType.identity ? Identity :
	T extends typeof mType.list ? UserSum[] :
	T extends typeof mType.delmsg ? number[] :
	T extends typeof mType.emote ? Record<string, string> :
	ChatMessage;
};

//Send helper function
function send<T extends MessageType>(to: Target, metype: T, msg: MessagePayloadMap[T]): void {
	//double check target
	if (!(to instanceof Server) && !(to instanceof Socket)){
		throw new Error('Invalid emit target')
	}

	//Fire it off
	to.emit(metype, msg)
}

//Sys message function
function sendSys(to: Target, type: TextPayload, text: string) {
	return send(to, type, createMsg(true,'system',text, type));
}


//Helper function for ChatMessage construction
//sys message overload
function createMsg(sys: false, author: Identity, content: string, metype: TextPayload): ChatMessage;
function createMsg(sys: true, author: string, content: string, metype: TextPayload): ChatMessage;
//function
function createMsg(sys: boolean = false, author: Identity | string = 'system', content: string, metype: TextPayload): ChatMessage {
		return {
		id: sys? -1: messageCounter.val++,
		author: typeof author === 'string' ? author : author.nick,
		content: content,
		timestamp: Date.now(),
		type: metype
	};
}

//Helper function for socketUsers updates
function updateSocketUser(socketID: string, identity: Identity, updateType: 'update' | 'delete'): void {
	if(updateType === 'update'){
		socketUsers.set(socketID, identity);
		for (const [sId, user] of socketUsers.entries()) {
			if (user.guid === identity.guid && sId !== socketID) {
				socketUsers.set(sId, identity); 
			}
		}
	}
	else if(updateType === 'delete'){
		socketUsers.delete(socketID)
	}
	else throw new Error(`bad update type ${updateType}`);
	
	uList = Array.from(socketUsers.values())
		.map(({ nick, status, isAfk }) => ({ nick, status, isAfk }))
		.sort((a,b) =>{
			if(a.isAfk !== b.isAfk){
				return a.isAfk ? 1 : -1;
			}
			return a.nick.substring(7).localeCompare(b.nick.substring(7), 'en', {sensitivity: 'base'});
		});
	
	const lurkers = io.sockets.sockets.size - socketUsers.size;
	uList.push({
		nick: '#NONVALlurkers',
		status: `${lurkers}`,
		isAfk: true
	})

	send(io, mType.list, uList);
	return;
}

//CONNECTION POINT

io.on('connection', (socket) => {

	//On connection welcome and announcement messages and emote payload
	sendSys(socket, mType.welcome, `${config.welcomeMsg}`)
	if (announcement){
		sendSys(socket, mType.ann, `announcemet: ${announcement}`)
	}
	if(emotes.size > 0){
		const emotePayload = Object.fromEntries(emotes);
		send(socket, mType.emote, emotePayload);
	}

	//identity service stuff
	const clientGUID = socket.handshake.auth.token;
	let returningUser: Identity | null = null;
	try{
		returningUser = identityService.getUser(clientGUID)
	} catch (error: any){
		console.warn(`${error.message}`);
	}

	//Returning user check
	if (returningUser) {
		updateSocketUser(socket.id, returningUser, 'update');
		send(socket, mType.identity, returningUser);
		sendSys(socket, mType.info, `welcome back, ${returningUser.nick.substring(7)}`);
	} 
	//New user flow
	else {
		sendSys(socket,mType.error,"system: please use the /nick <nickname> to set a nickname or /import <GUID> to import one");
		//GDPR warning
		sendSys(socket,mType.error,"system: be aware either command will store data regarding your session. type '/gdpr info' for more info");
		//force update socket users for lurkers check
		updateSocketUser('refresh-trigger', {} as Identity, 'delete');
	}

	//A new user has connected	
	console.log('a user connected');
	send(socket,mType.list, uList)
	for (const [id, msg] of chatHistory){
		send(socket, mType.chat, msg)
	}

	//Returning user announcement
	if (returningUser){
		sendSys(io,mType.ann,`${returningUser.nick.substring(7)} connected`);
	}

	//When a message is recieved from a client
	socket.on('toServerChat', async (msg, callback) => {
		// Set user context
		const user = socketUsers.get(socket.id);

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
			sendSys(socket, mType.error, "system: please set your nickname with /chrat <nickname> before chatting");
			if (typeof callback === 'function') callback();
			return;
		}

		//Check message length	
		if (msg.length > config.maxMsgLen) {
			sendSys(socket, mType.error, 'system: sorry your message is too long lmao');
			return;
		}
		else if (msg.trim().length === 0){
			return;
		}

		//Profanity check
		try{
			moderationService.profCheck(msg);
		}
		catch(e: any){
			sendSys(socket, mType.error, `${e.message}`)
			return;
		}
		console.log('message: ' + msg);

		try{
			//Timeout check
			moderationService.timeCheck(user, tType.chat);
					
			//Build message JSON Object
			const chatmsg = createMsg(false, user, msg, mType.chat);

			//Save message to array and delete oldest if necessary
			chatHistory.set(chatmsg.id, chatmsg);
			try{
				identityService.setLastMessage(user.guid, chatmsg.timestamp);
				if (chatHistory.size > config.msgArrayLen){
					const oldestMessage = chatHistory.keys().next().value;
					if (oldestMessage !== undefined) {
						chatHistory.delete(oldestMessage);
					}
				}
			} catch (error: any){
				console.warn(`${error.message}`);
			}

			//Send message JSON object to all connected sockets
			send(io, mType.chat, chatmsg);

			//Send callback for input clearing
			if (typeof callback === 'function') {
				callback();
			}
		}catch(e: any){
			sendSys(socket, mType.error, `${e.message}`)
		}
	});

	//On socket discconect flow
	socket.on('disconnect', () => {
	console.log('a user disconnected');

	const disuser = socketUsers.get(socket.id);
		if(disuser){
			updateSocketUser(socket.id, disuser, 'delete');
			sendSys(io, mType.ann, `${disuser.nick.substring(7)} disconnected`);
		}
		else{
			//lurker disconnect
			updateSocketUser('refresh-trigger', {} as Identity, 'delete');
		}
	});
});

//Get HTML file
app.get('/ratchat', (req, res) => {
	res.setHeader('X-Robots-Tag', 'noindex, nofollow');
	res.sendFile('www/ratchat.html', { root : __dirname });
});

//Server standup
httpserver.listen(config.PORT, () => {
	console.log(JSON.stringify(config));
	console.log(`server running at http://localhost:${config.PORT}`);
});

//Fetch emotes
try{
	await configService.emoteLoad(io)
	console.log('startup emotes loaded');
}
catch(e: any){
	console.warn(`startup emotes failed: ${e.message}`);
};