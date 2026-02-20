import { Server, Socket} from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { Identity, ChatMessage, MessageType } from '../shared/types.ts';
import { IdentityService } from './services/identity.ts'
import { CommandService } from './services/command.ts';
import { mType } from '../shared/types.ts';

//TODO: ip collection
//TODO: timeout enforcement
//TODO: ban enforcement
//TODO: add /nick timing restriction
//TODO: message deletion
//TODO: nickname protection
//TODO: bad word enforcement
//TODO: announcement santiziation
//TODO: client 7tv integration?
//TODO: client background changing?
//TODO: MIT licenses?

const config = JSON.parse(readFileSync('./config.json', 'utf-8'));
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {connectionStateRecovery:{}});
const __dirname = dirname(fileURLToPath(import.meta.url));
const usersPath = join(__dirname, 'data', 'users.json');

const socketUsers = new Map<string, Identity>();
const chatHistory = new Map<number, ChatMessage>();

//Sys message shorthand
const sendSys = (to: Target, type: MessageType, text: string) => send(to, type, createMsg(true,'system',text,type as any));

const identityService = new IdentityService(usersPath);
const commandService = new CommandService({
    identityService: identityService,
    send: send,
    sendSys: sendSys,
    updateSocketUser: updateSocketUser,
    setAnnouncement: (text: string) => { announcement = text; },
	chatHistory: chatHistory,
});


let messageCounter = {val: 0};

var announcement = '';
var uList: UserSum[] = [];

type UserSum = Pick<Identity, "nick" | "status" | "isAfk">
type Target = Server | Socket;
type Payload = ChatMessage | Identity | UserSum[] | number[];

//Send helper function
function send(to: Target, metype: MessageType, msg: Payload): void {	
	//double check target
	if (!(to instanceof Server) && !(to instanceof Socket)){
		throw new Error('Invalid emit target')
	}
	//Confirm payload typing
	if (metype === mType.identity) {
			// Check if msg has Identity properties
			if (!msg || typeof msg !== 'object' || !('guid' in msg)) {
				throw new Error(`payload mismatch: ${metype} requires an Identity object.`);
			}
		} 
		else if (metype === mType.list) {
			// Check if msg is an array (userSum[])
			if (!Array.isArray(msg)) {
				throw new Error(`payload mismatch: ${metype} requires a userSum array.`);
			}
		} 
		else if (metype === mType.delmsg){
			if (!Array.isArray(msg)){
				throw new Error(`payload mismatch: ${metype} requires a number array.`);
			}
		}
		else {
			if (!msg || typeof msg !== 'object' || !('content' in msg)) {
				throw new Error(`payload mismatch: ${metype} requires a ChatMessage object.`);
			}
		}
	//Fire it off
	to.emit(metype, msg)
}

//Helper function for ChatMessage construction
//Function overload: if sys is false, require an identity
function createMsg(
	sys: false, 
	author: Identity,
	content: string,
	metype: Exclude<MessageType, typeof mType.identity | typeof mType.list>
): ChatMessage;
//if sys is true, use the system string
function createMsg(
	sys: true,
	author: string,
	content: string,
	metype: Exclude<MessageType, typeof mType.identity | typeof mType.list>
): ChatMessage;
//final overload
function createMsg(
	sys: boolean = false,
	author: Identity | string = 'system',
	content: string,
	metype: Exclude<MessageType, typeof mType.identity | typeof mType.list>
	): ChatMessage {
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
		socketUsers.set(socketID, identity)
	}
	else if(updateType === 'delete'){
		socketUsers.delete(socketID)
	}
	else throw new Error(`bad update type ${updateType}`);
	uList = Array.from(socketUsers.values()).map(({ nick, status, isAfk }) => ({
		nick,
		status,
		isAfk
	}));
	send(io, mType.list, uList);
	return;
}

//CONNECTION POINT

io.on('connection', (socket) => {

	//On connection welcome and announcement messages
	sendSys(socket, mType.welcome, `${config.welcomeMsg}`)
	if (announcement){
		sendSys(socket, mType.ann, `announcemet: ${announcement}`)
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
	socket.on('toServerChat', (msg, callback) => {
		// Set user context
		const user = socketUsers.get(socket.id);

		// Check if it's a command
		if (msg.startsWith('/')) {
			const args = msg.slice(1).trim().split(/ +/);
			const commandName = args.shift()?.toLowerCase() || '';
			let commandUser: Identity | null = null;
			try {
				commandUser = identityService.getUser(socket.handshake.auth.token);
			} catch { /* Guest user */ }
			commandService.execute(commandName, {
				socket,
				io,
				args,
				fullArgs: args.join(' '),
				commandUser
			});
			if (typeof callback === 'function') callback();
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
	
		console.log('message: ' + msg);

		//slowmode check
		const timeoutUser = returningUser?.lastMessage
		if(timeoutUser){
			const timeoutTime = new Date(timeoutUser).getTime() + (config.slowMode*1000);
			const now = Date.now();
			const waitTime = (timeoutTime - now)/1000;

			if(now < timeoutTime){
				sendSys(socket, mType.error, `system: you're doing that too fast, wait ${Math.ceil(waitTime)} seconds.`);
				return;
			}else{
				//Build message JSON Object
				const chatmsg = createMsg(false, user, msg, mType.chat);

				//Save message to array and delete oldest if necessary
				chatHistory.set(chatmsg.id, chatmsg);
				identityService.setLastMessage(user.guid, chatmsg.timestamp);
				if (chatHistory.size > config.msgArrayLen){
					const oldestMessage = chatHistory.keys().next().value;
					if (oldestMessage  !== undefined) {
						chatHistory.delete(oldestMessage);
					}
				}

			//Send message JSON object to all connected sockets
			send(io, mType.chat, chatmsg);

			//Send callback for input clearing
			if (typeof callback === 'function') {
				callback();
			}
			}
		}
    });

	//On socket discconect flow
    socket.on('disconnect', () => {
	console.log('a user disconnected');
	const disuser =socketUsers.get(socket.id)
	if(disuser){
	updateSocketUser(socket.id, disuser, 'delete');
	sendSys(io, mType.ann, `${disuser.nick.substring(7)} disconnected`);
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