import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { Identity, ChatMessage } from '../shared/types.ts';
import { IdentityService } from './services/identity.ts'


const config = JSON.parse(readFileSync('./config.json'));
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {
		     connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

const identityService = new IdentityService();
const socketUsers = new Map<string, Identity>();



app.get('/ratchat', (req, res) => {
    res.sendFile('www/ratchat.html', { root : __dirname });
});

let messageCounter = 0;

io.on('connection', (socket) => {
	socket.emit("toClientWelcome", `Welcome: ${config.welcomeMsg}`)
	
	//identity service stuff
	const clientGUID = socket.handshake.auth.token;

	const returningUser = clientGUID ? identityService.getUser(clientGUID) : undefined;

	if (returningUser) {
	    socketUsers.set(socket.id, returningUser);
	    socket.emit('identity', returningUser);
	    socket.emit('toClientWelcome', `Welcome back ${returningUser.nick.substring(7)}`);
	} else {
	    socket.emit('toClientMsg', "system: please use the /chrat <nickname> to set a nickname");
	}

	//A new user has connected	
	console.log('a user connected');

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

			switch (command) {
				case 'help':
				case 'commands':
				case 'h':
					const helpMessages = [
						'/help, /h, or /commands : View this list.',
						'/chat or /nick <nickname> : Change your nickname to <nickname>.',
						"/color <#RRGGBB> : Change your nickname's color to hex #RRGGBB."
					];

					// TODO Check if user has moderator privileges
					helpMessages.push(
							'',
							'--- Moderator Commands ---',
							'/ban <user> : Permanently bans a user with nickname "user"',
							'/timeout <user> : Deletes recent messages from nickname "user" and mutes them for the timeout period. (default 5 min)',
							'/delete <1> : Delete a message with ID 1. Find message IDs by hovering the relevant message.',
							'/announcement <text> : Send an announcement to all users. New users who join will see the most recent announcement.')
					helpMessages.forEach(helpMsg => socket.emit("toClientWelcome", helpMsg));

					if (typeof callback === 'function') callback();
					return;

				case 'nick':
				case 'chrat':
					if (args[0].length < 2 || args[0].length > 15) {
					    socket.emit('toClientMsg', "system: please provide a username with at least 2 but less than 15 characters");
					} else {
						try {
							const userGUID = user ? user.guid : (clientGUID || null);
							const oldNick = user ? user.nick: null;
							const updateUser = identityService.userResolve(userGUID, args[0]);
							socketUsers.set(socket.id, updateUser);
							socket.emit('identity', updateUser);
							if (oldNick) {
								io.emit('toClientAnnouncement', `system: ${oldNick.substring(7)} changed their username to ${updateUser.nick.substring(7)}`);
								if (typeof callback === 'function') callback();
							} else {
								io.emit('toClientAnnouncement', `system: ${updateUser.nick.substring(7)} has joined teh ratchat`);
								if (typeof callback === 'function') callback();
							}
						} catch (e: any) {
							socket.emit('toClientMsg', `system error: ${e.message}`);
						}
					}
					return;

				case 'color':
					if (!user) {
						socket.emit('toClientMsg', "system: please use /chrat <nickname> before trying to set a color");
						return;
					}
					if (args.length === 0 || args[0] < 7) {
						socket.emit('toClientMsg', "system: provide a hex value for the color you want to set e.g. /color #000000");
					} else {
						try {
							const trimNick = user.nick.substring(7);
							const updateUser = identityService.userResolve(user.guid, trimNick, args[0]);
							socketUsers.set(socket.id, updateUser);
							socket.emit('identity', updateUser);
							socket.emit('toClientAnnouncement', `system: your color has been updated to ${args[0]}`);
						} catch (e: any) {
						    socket.emit('toClientMsg', `system error: ${e.message}`);
						}
					}
					if (typeof callback === 'function') callback();
					return;

				case 'colour':
					socket.emit("toClientMsg", "system: lern to speak american")
					return;

				case 'ban':
					if (args.length === 0) return socket.emit("toClientMsg", "missing target");
					// TODO: Mod verification
					io.emit("toClientMsg", `system: ${fullArgs} has been banned.`);
					if (typeof callback === 'function') callback();
					return;

				case 'timeout':
				case 'to':
					if (args.length === 0) return socket.emit("toClientMsg", "missing target");
					// TODO: Mod verification
					io.emit("toClientMsg", `system: ${fullArgs} has been timed out.`);
					if (typeof callback === 'function') callback();
					return;

				case 'delete':
					if (args.length === 0 || isNaN(Number(args[0]))) return socket.emit("toClientMsg", "please provide message id");
					// TODO: Mod verification
					socket.emit("toClientMsg", `system: deleting message ${fullArgs}`);
					if (typeof callback === 'function') callback();
					return;

				case 'announce':
					// TODO: Mod verification
					io.emit("toClientAnnouncement", `announcement: ${fullArgs}`);
					if (typeof callback === 'function') callback();
					return;
				
				default:
					socket.emit("toClientMsg", "system: that's not a command lol");
			}
			return;
		}

		if (!user) {
		    socket.emit('toClientMsg', "system: please set your nickname with /chrat <nickname> before chatting");
		    if (typeof callback === 'function') callback();
		    return;
		}

		//Check message length	
		if (msg.length > config.maxMsgLen) {
	    	socket.emit("toClientMsg", 'system: sorry your message is too long lmao');
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
		//Send message JSON object to all connected sockets
		io.emit('chat message', chatmsg);

		//Send callback for input clearing
		if (typeof callback === 'function') {
			callback();
		}
    });


    socket.on('disconnect', () => {
	console.log('a user disconnected');
	socketUsers.delete(socket.id);
	if (returningUser){
	io.emit('toClientAnnouncement', `${returningUser.nick.substring(7)} disconnected`);
	}
    });
});


httpserver.listen(config.PORT, () => {
    console.log(JSON.stringify(config));
    console.log(`server running at http://localhost:${config.PORT}`);
});
