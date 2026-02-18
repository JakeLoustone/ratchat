import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { Identity, ChatMessage } from '../shared/types.ts';
import { IdentityService } from './services/identity.ts'
import { error } from 'node:console';


const config = JSON.parse(readFileSync('./config.json'));
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {
		     connectionStateRecovery: {}
});
const __dirname = dirname(fileURLToPath(import.meta.url));
const usersPath = join(__dirname, 'data', 'users.json');

const identityService = new IdentityService(usersPath);
const socketUsers = new Map<string, Identity>();
const chatHistory = new Map<number, ChatMessage>();
var announcement = '';
var uList: userSum[] = [];

type userSum = Pick<Identity, "nick" | "status" | "isAfk">

app.get('/ratchat', (req, res) => {
	res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile('www/ratchat.html', { root : __dirname });
});

let messageCounter = 0;

io.on('connection', (socket) => {
	//On connection welcome and announcement messages
	socket.emit("toClientWelcome", `${config.welcomeMsg}`)
	if (announcement){
		socket.emit("toClientAnnouncement", `announcement: ${announcement}`)
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
	    socket.emit('identity', returningUser);
	    socket.emit('toClientInfo', `welcome back, ${returningUser.nick.substring(7)}`);
	} else {
	    socket.emit('toClientError', "system: please use the /chrat <nickname> to set a nickname");
	}

	//A new user has connected	
	console.log('a user connected');
	socket.emit('userlist',uList)
	for (const [id, msg] of chatHistory){
		socket.emit('chat message', msg);
	}

	//Returning user announcement
	if (returningUser){
		io.emit('toClientAnnouncement', `${returningUser.nick.substring(7)} connected`);
	}

	//When a message is recieved from a client
	socket.on('chat message', (msg, callback) => {
		// Set user context
		const user = socketUsers.get(socket.id);

		// Check if it's a command
		if (msg.startsWith('/')) {
		    
			// Split into command
			const args = msg.slice(1).trim().split(/ +/);
			const command = args.shift().toLowerCase(); // Get the first word and remove from args array
			const fullArgs = args.join(' '); // Rejoin the rest for messages/targets
			let commandUser: Identity | null = null;
			try{
				commandUser = identityService.getUser(clientGUID)
			} catch (error: any){
				console.warn(`${error.message}`);
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
						'/import : import a GUID exported earlier to reclaim your nickname on another device or browser. must match exactly!'
						
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
					
						helpMessages.forEach(helpMsg => socket.emit("toClientInfo", helpMsg));

					if (typeof callback === 'function') callback();
					return;
				
				//Change nickname
				case 'nick':
				case 'chrat':
					if (!args[0] || args[0].length < 2 || args[0].length > 15) {
					    socket.emit('toClientError', "system: please provide a username with at least 2 but less than 15 characters");
					} else {
						try {
							const userGUID = user ? user.guid : (clientGUID || null);
							const oldNick = user ? user.nick: null;
							const updateUser = identityService.userResolve(userGUID, args[0]);
							updateSocketUser(socket.id, updateUser,'update');
							socket.emit('identity', updateUser);
							if (oldNick) {
								io.emit('toClientAnnouncement', `${oldNick.substring(7)} changed their username to ${updateUser.nick.substring(7)}`);
								if (typeof callback === 'function') callback();
							} else {
								io.emit('toClientAnnouncement', `${updateUser.nick.substring(7)} has joined teh ratchat`);
								if (typeof callback === 'function') callback();
							}
						} catch (e: any) {
							socket.emit('toClientError', `system error: ${e.message}`);
						}
					}
					return;

				//Change nickname color
				case 'color':
					if (!user) {
						socket.emit('toClientError', "system: please use /chrat <nickname> before trying to set a color");
						return;
					}
					if (args.length === 0) {
						socket.emit('toClientError', "system: provide a hex value for the color you want to set e.g. /color #000000");
					} else {
						try {
							const trimNick = user.nick.substring(7);
							const updateUser = identityService.userResolve(user.guid, trimNick, args[0]);
							updateSocketUser(socket.id, updateUser, 'update');
							socket.emit('identity', updateUser);
							socket.emit('toClientInfo', `system: your color has been updated to ${args[0]}`);
						} catch (e: any) {
						    socket.emit('toClientError', `system error: ${e.message}`);
						}
					}
					if (typeof callback === 'function') callback();
					return;	
				case 'colour':
					socket.emit("toClientError", "system: lern to speak american")
					return;

				//Import GUID that has been previously exported
				case 'import':
					//Verify legitimate GUID via regex
					const GUIDregex = new RegExp("^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$");
					const newGUID = args[0]
					if(!GUIDregex.test(newGUID)){
						socket.emit('toClientError', "system: not a valid GUID");
						return;
					}
					//Call identity service to handle new GUID
					if(GUIDregex.test(newGUID)){
						let updateUser: Identity | null = null;
						try{
							updateUser = identityService.getUser(newGUID);
							updateSocketUser(socket.id, updateUser, 'update');
							socket.emit('identity', updateUser);
							socket.emit('toClientInfo', `system: identity changed to ${updateUser.nick.substring(7)}`);

							//Announce disconnect if user was listed previously
							if(commandUser?.nick !== undefined){
								io.emit('toClientAnnouncement', `${commandUser?.nick.substring(7)} disconnected`);
							}
							
							//Announce new user connection
							io.emit('toClientAnnouncement', `${updateUser.nick.substring(7)} connected`);
							if (typeof callback === 'function') callback();
							return;
						} catch (e: any) {
							socket.emit('toClientError', `system error: ${e.message}`);
							return;
						}
					}
					return;

				//Toggle AFK status in user listing
				case 'afk':
					if (!user) {
						socket.emit('toClientError', "system: please use /chrat <nickname> before trying to go afk lmao");
						return;
					}
					try {
							const afkUser = identityService.toggleAfk(user.guid);
							if (afkUser.isAfk){
								socket.emit('toClientInfo', "you've gone afk");
							}
							else{
								socket.emit('toClientInfo', `welcome back, ${afkUser.nick.substring(7)}`);
							}
							updateSocketUser(socket.id, afkUser, 'update');
													
						} catch (e: any) {
						    socket.emit('toClientError', `system error: ${e.message}`);
							return;
						}
					if (typeof callback === 'function') callback();
					return;

				//IP ban a user via nickname
				case 'ban':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						return socket.emit("toClientError", "system: naughty naughty");
					}
					if(commandUser?.isMod){
						if (args.length === 0) return socket.emit("toClientError", "missing target");

						io.emit("toClientInfo", `system: ${fullArgs} has been banned.`);
						if (typeof callback === 'function') callback();
						return;
					}
					return;
				
				//Timeout a user preventing further chatting for 5 min
				case 'timeout':
				case 'to':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						return socket.emit("toClientError", "system: naughty naughty");
					}
					if(commandUser?.isMod){
						if (args.length === 0) return socket.emit("toClientError", "missing target");

						io.emit("toClientInfo", `system: ${fullArgs} has been timed out.`);
						if (typeof callback === 'function') callback();
						return;
					}
					return;
				
				//Deletes a message from message history buffer and asks clients nicely to remove from screen
				case 'delete':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						return socket.emit("toClientError", "system: naughty naughty");
					}
					if(commandUser?.isMod){
						if (args.length === 0 || isNaN(Number(args[0]))) return socket.emit("toClientError", "please provide message id");
						socket.emit("toClientInfo", `system: deleted message ID ${fullArgs}`);
						if (typeof callback === 'function') callback();
						return;
					}
					return;

				//Send a global announcement that is stored until server reset
				case 'announce':
				case 'announcement':
					if(!commandUser?.isMod){
						if (typeof callback === 'function') callback();
						return socket.emit("toClientError", "system: naughty naughty");
					}
					if(commandUser?.isMod){
						announcement = `${fullArgs}`
						io.emit("toClientAnnouncement", `announcement: ${announcement}`);
						if (typeof callback === 'function') callback();
						return;
					}
				
				//Failcase
				default:
					socket.emit("toClientError", "system: that's not a command lol");
			}
			return;
		}

		//Prevent users from chatting without an identity
		if (!user) {
		    socket.emit('toClientError', "system: please set your nickname with /chrat <nickname> before chatting");
		    if (typeof callback === 'function') callback();
		    return;
		}

		//Check message length	
		if (msg.length > config.maxMsgLen) {
	    	socket.emit("toClientError", 'system: sorry your message is too long lmao');
	    	return;
		}
	
		console.log('message: ' + msg);
		
		//Build message JSON Object
		const chatmsg: ChatMessage = {
			id: messageCounter++,
			author: user.nick,
			content: msg,
			timestamp: Date.now(),
			type: "chat message"
		};
		//Save message to array and delete oldest if necessary
		chatHistory.set(chatmsg.id, chatmsg)
		if (chatHistory.size > config.msgArrayLen){
			const oldestMessage = chatHistory.keys().next().value;
			if (oldestMessage  !== undefined) {
       			chatHistory.delete(oldestMessage);
    		}
		}
		//Send message JSON object to all connected sockets
		io.emit('chat message', chatmsg);

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
	io.emit('toClientAnnouncement', `${disuser.nick.substring(7)} disconnected`);
	}
    });
});


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
	io.emit('userlist', uList);
	return;
}

//Server standup
httpserver.listen(config.PORT, () => {
    console.log(JSON.stringify(config));
    console.log(`server running at http://localhost:${config.PORT}`);
});