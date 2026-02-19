import { Server, Socket} from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { Identity, ChatMessage, MessageType } from '../shared/types.ts';
import { IdentityService } from './services/identity.ts'
import { mType } from '../shared/types.ts';

//TODO: refactor command handling
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

const identityService = new IdentityService(usersPath);
const socketUsers = new Map<string, Identity>();
const chatHistory = new Map<number, ChatMessage>();

let messageCounter = {val: 0};

var announcement = '';
var uList: UserSum[] = [];

type UserSum = Pick<Identity, "nick" | "status" | "isAfk">
type Target = Server | Socket;
type Payload = ChatMessage | Identity | UserSum[];



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

//Sys message shorthand
const sendSys = (to: Target, type: MessageType, text: string) => send(to, type, createMsg(true,'system',text,type as any));

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
	} else {
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
		    
			// Split into command
			const args = msg.slice(1).trim().split(/ +/);
			const command = args.shift().toLowerCase(); // Get the first word and remove from args array
			const fullArgs = args.join(' '); // Rejoin the rest for messages/targets
			let commandUser: Identity | null = null;
			commandUser = socketUsers.get(socket.id) || null;
			if (!commandUser && clientGUID) {
				try {
					commandUser = identityService.getUser(clientGUID);
				} catch (error: any) {
					console.warn(`${error.message}`);
				}
			}
			switch (command) {
				//List all commands
				case 'help':
				case 'commands':
				case 'h':
					const helpMessages = [
						'/help, /h, or /commands : View this list.',
						'/chrat or /nick <nickname> : Change your nickname to <nickname>.',
						"/color <#RRGGBB> : Change your nickname's color to hex #RRGGBB.",
						'/clear or /clr : removes all visible messsages on your screen. (others can still see them)',
						//export is handled client side
						"/export : returns your GUID for later importing on other devices. if you like your name don't share it :)",
						'/import : import a GUID exported earlier to reclaim your nickname on another device or browser. must match exactly!',
						'/afk : toggle AFK status in the user listing',
						'/status or /me : set your status in the user listing',
						'/gdpr <flag> : <info> for more information, <export> for a copy of your data, and <delete> to wipe your data.'
						
					];
					//Show moderator commands only if user is a mod
					if(commandUser?.isMod){
						helpMessages.push(
							'--- Moderator Commands ---',
							'/ban <user> : Permanently bans a user with nickname "user"',
							'/timeout or /to <user> : Deletes recent messages from nickname "user" and mutes them for the timeout period. (default 5 min)',
							'/delete <1> : Delete a message with ID 1. Find message IDs by hovering the relevant message.',
							'/announce or /announcement <text> : Send an announcement to all users. New users who join will see the most recent announcement.')
					}
						helpMessages.forEach(helpMsg => sendSys(socket,mType.info, helpMsg));

					if (typeof callback === 'function') callback();
					return;
				
				//Change nickname
				case 'nick':
				case 'chrat':
					if (!args[0] || args[0].length < 2 || args[0].length > 15) {
						sendSys(socket,mType.error,'system: please provide a username with at least 2 but less than 15 characters');
					} else {
						try {
							const userGUID = user ? user.guid : (clientGUID || null);
							const oldNick = user ? user.nick: null;
							const updateUser = identityService.userResolve(userGUID, args[0]);
							updateSocketUser(socket.id, updateUser,'update');
							send(socket,mType.identity,updateUser);
							if (oldNick) {
								sendSys(io, mType.ann, `${oldNick.substring(7)} changed their username to ${updateUser.nick.substring(7)}`);
								if (typeof callback === 'function') callback();
							} else {
								sendSys(io, mType.ann, `${updateUser.nick.substring(7)} has joined teh ratchat`);
								if (typeof callback === 'function') callback();
							}
						} catch (e: any) {
							sendSys(socket, mType.error, `system error: ${e.message}`);
						}
					}
					return;

				//Change nickname color
				case 'color':
					if (!user) {
						sendSys(socket, mType.error, "system: please use /chrat <nickname> before trying to set a color");
						return;
					}
					if (args.length === 0) {
						sendSys(socket, mType.error, "system: provide a hex value for the color you want to set e.g. /color #000000");
					} else {
						try {
							const trimNick = user.nick.substring(7);
							const updateUser = identityService.userResolve(user.guid, trimNick, args[0]);
							updateSocketUser(socket.id, updateUser, 'update');
							send(socket, mType.identity, updateUser);
							sendSys(socket, mType.info, `system: your color has been updated to ${args[0]}`);
						} catch (e: any) {
						    sendSys(socket, mType.error, `system error: ${e.message}`);
						}
					}
					if (typeof callback === 'function') callback();
					return;	
				case 'colour':
					sendSys(socket, mType.error, "system: lern to speak american")
					return;

				//Import GUID that has been previously exported
				case 'import':
					//Verify legitimate GUID via regex
					const GUIDregex = new RegExp("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$");
					const newGUID = args[0]
					if(!GUIDregex.test(newGUID)){
						sendSys(socket, mType.error, "system: not a valid GUID");
						return;
					}
					//Call identity service to handle new GUID
					if(GUIDregex.test(newGUID)){
						let updateUser: Identity | null = null;
						try{
							updateUser = identityService.getUser(newGUID);
							updateSocketUser(socket.id, updateUser, 'update');
							send(socket, mType.identity, updateUser);
							sendSys(socket, mType.info, `system: identity changed to ${updateUser.nick.substring(7)}`);

							//Announce disconnect if user was listed previously
							if(commandUser?.nick !== undefined){
								sendSys(io, mType.ann, `${commandUser?.nick.substring(7)} disconnected`);
							}
							
							//Announce new user connection
							sendSys(io, mType.ann, `${updateUser.nick.substring(7)} connected`);
							if (typeof callback === 'function') callback();
							return;
						} catch (e: any) {
							sendSys(socket, mType.error, `system error: ${e.message}`);
							return;
						}
					}
					return;

				//Toggle AFK status in user listing
				case 'afk':
					if (!user) {
						sendSys(socket, mType.error, "system: please use /chrat <nickname> before trying to go afk lmao");
						return;
					}
					try {
							const afkUser = identityService.toggleAfk(user.guid);
							if (afkUser.isAfk){
								sendSys(socket, mType.info, "you've gone afk");
							}
							else{
								sendSys(socket, mType.info, `welcome back, ${afkUser.nick.substring(7)}`);
							}
							updateSocketUser(socket.id, afkUser, 'update');
													
						} catch (e: any) {
						    sendSys(socket, mType.error, `system error: ${e.message}`);
							return;
						}
					if (typeof callback === 'function') callback();
					return;
				
				//Set status for user listing
				case 'status':
				case 'me':
					
					const rawStatus = fullArgs
					//Sanitize :)
					const noHtml = rawStatus.replace(/<[^>]*>?/gm, '');
					//ASCII filter
					const newStatus = noHtml.replace(/[^\x20-\x7E]/g, '');
					if(newStatus.length > 32){
						sendSys(socket, mType.error, 'system: tl;dr - set something shorter');
						return;
					}
					if(commandUser){
						try{
							const updatedUser = identityService.setStatus(commandUser.guid, newStatus);
							updateSocketUser(socket.id, updatedUser, "update");
							sendSys(socket, mType.info, `your status is now: ${updatedUser.status}`);
							if (typeof callback === 'function') callback();
							return;
						} catch (e: any) {
							sendSys(socket, mType.error, `system error: ${e.message}`);
						}
					}else{
						sendSys(socket, mType.error, "system: please use /chrat <nickname> before trying to facebook post");
						if (typeof callback === 'function') callback();
					}
					return;

				//GDPR command so the EU doesn't disappear us
				case 'gdpr':
					if (args.length === 0 ){
						sendSys(socket, mType.error, "system: please use with 'info', 'export' or 'delete' after /gdpr");
						return;
					}
					const subComm = args[0]
					
					//GDPR switch
					switch (subComm){
						case 'info':
							const gdprMessages = [
							'---------------------------------------------------------------------------------------------',
							'We store the following data server side:',
							'guid			|	Unique identifier and allows multiple sessions to have the same nickname',
							'nick			|	Chosen nickname and color set by the /nick and /color commands',
							'status			|	Chosen status displayed in user listing set by /status command',
							'isMod			|	Flag for allowing moderator actions',
							'lastMessage	|	Timestamp of last message sent fortimeout enforcement and nickname cleanup',
							'isAfk			|	AFK flag for user listing set by /afk command',
							'ip				|	Last known ip address for ban enforcement if necessary',
							'---------------------------------------------------------------------------------------------',
							'We store the following information locally:',
							'ratGUID		|	a local copy of the GUID for message construction',
							'---------------------------------------------------------------------------------------------',
							'Use /gdpr export to see a copy of your data stored on the server, if any.',
							'Use /gdpr delete to permanently remove your data from the server. this will prevent you from utilizing the application.'
							]	
							gdprMessages.forEach(helpMsg => sendSys(socket, mType.info, helpMsg));
							if (typeof callback === 'function') callback();
							return;
						case 'export':
							if (!commandUser) {
								sendSys(socket, mType.error, "system: no server stored data");
								if (typeof callback === 'function') callback();
								return;
							}
							else{
								sendSys(socket, mType.info, `Server stored info: ${JSON.stringify(commandUser, null, 4)}`);
								if (typeof callback === 'function') callback();
								return;
							}
						case 'delete':
							if (!commandUser){
								sendSys(socket, mType.error, "system: no server stored data");
								if (typeof callback === 'function') callback();
								return;
							}
							else{
								try{
									identityService.deleteUser(commandUser.guid);
									updateSocketUser(socket.id, commandUser, 'delete');

									//local deletion ID
									const sentinelId = {guid: 'RESET_IDENTITY'} as Identity;
									send(socket, mType.identity, sentinelId);

									sendSys(socket, mType.info, 'goodbye is ur data');
									sendSys(io, mType.ann, `${commandUser.nick.substring(7)} disconnected`)
									if (typeof callback === 'function') callback();
								}
								catch(e: any) {
						    	sendSys(socket, mType.error, `system error: ${e.message}`);
								return;
								}
							return;
							}
							
						default:
							sendSys(socket, mType.error, "system: please use with 'info', 'export' or 'delete' after /gdpr");
					return;
					}

				// ------------------------
				// MODERATOR COMMANDS BELOW:
				// ------------------------

				//IP ban a user via nickname
				case 'ban':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						sendSys(socket, mType.error, "system: naughty naughty");
						return;
					}
					if(commandUser?.isMod){
						if (args.length === 0){
							sendSys(socket, mType.error, "missing target");
							return;
						}

						sendSys(io, mType.info, `system: ${fullArgs} has been banned.`);
						if (typeof callback === 'function') callback();
						return;
					}
					return;
				
				//Timeout a user preventing further chatting for 5 min
				case 'timeout':
				case 'to':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						sendSys(socket, mType.error, "system: naughty naughty");
						return;
					}
					if(commandUser?.isMod){
						if (args.length === 0){
							sendSys(socket, mType.error, "missing target");
							return;
						}

						sendSys(io, mType.info, `system: ${fullArgs} has been timed out.`);
						if (typeof callback === 'function') callback();
						return;
					}
					return;
				
				//Deletes a message from message history buffer and asks clients nicely to remove from screen
				case 'delete':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						sendSys(socket, mType.error, "system: naughty naughty");
						return;
					}
					if(commandUser?.isMod){
						if (args.length === 0 || isNaN(Number(args[0]))){
							sendSys(socket, mType.error, "please provide message id");
							return;
						}
						sendSys(socket, mType.info, `system: deleted message ID ${fullArgs}`);
						if (typeof callback === 'function') callback();
						return;
					}
					return;

				//Send a global announcement that is stored until server reset
				case 'announce':
				case 'announcement':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						sendSys(socket, mType.error, "system: naughty naughty");
						return;
					}
					if(commandUser?.isMod){
						announcement = `${fullArgs}`
						sendSys(io, mType.ann, `announcement: ${announcement}`);
						if (typeof callback === 'function') callback();
						return;
					}
				
				//Failcase
				default:
					sendSys(socket, mType.error, "system: that's not a command lol");
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
	
		console.log('message: ' + msg);
		
		//Build message JSON Object
		const chatmsg = createMsg(false, user, msg, mType.chat)

		//Save message to array and delete oldest if necessary
		chatHistory.set(chatmsg.id, chatmsg)
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