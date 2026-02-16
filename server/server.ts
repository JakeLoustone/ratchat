import { Server } from 'socket.io';
import express from 'express';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'fs';
import type { Identity, ChatMessage } from '../shared/types.ts';

const config = JSON.parse(readFileSync('./config.json'));
const app = express();
const httpserver = createServer(app);
const io = new Server(httpserver, {
		     connectionStateRecovery: {}
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/ratchat', (req, res) => {
    res.sendFile('www/ratchat.html', { root : __dirname });
});

let messageCounter = 0;

io.on('connection', (socket) => {
    //A new user has connected	
	console.log('a user connected');
	socket.emit("toClientWelcome", `Welcome: ${config.welcomeMsg}`)

	//When a message is recieved from a client
	socket.on('chat message', (msg, callback) => {


		// Check if it's a command
		if (msg.startsWith('/')) {
		    




			// Split into command
			const args = msg.slice(1).trim().split(/ +/);
			const command = args.shift().toLowerCase(); // Get the first word and remove from args array
			const fullArgs = args.join(' '); // Rejoin the rest for messages/targets

			switch (command) {
				case 'nick':
				case 'chrat':
					socket.emit("toClientMsg", "system: changing your nickname huh?");
					if (typeof callback === 'function') callback();
					break;

				case 'color':
					socket.emit("toClientMsg", "system: rainbow mode");
					if (typeof callback === 'function') callback();
					break;
				case 'ban':
					if (args.length === 0) return socket.emit("toClientMsg", "missing target");
					// TODO: Mod verification
					io.emit("toClientMsg", `system: ${fullArgs} has been banned.`);
					if (typeof callback === 'function') callback();
					break;
				case 'timeout':
					if (args.length === 0) return socket.emit("toClientMsg", "missing target");
					// TODO: Mod verification
					io.emit("toClientMsg", `system: ${fullArgs} has been timed out.`);
					if (typeof callback === 'function') callback();
					break;

				case 'delete':
					if (args.length === 0 || isNaN(Number(args[0]))) return socket.emit("toClientMsg", "please provide message id");
					// TODO: Mod verification
					socket.emit("toClientMsg", `system: deleting message ${fullArgs}`);
					if (typeof callback === 'function') callback();
					break;

				case 'announce':
					// TODO: Mod verification
					io.emit("toClientAnnouncement", `announcement: ${fullArgs}`);
					if (typeof callback === 'function') callback();
					break;

				default:
					socket.emit("toClientMsg", "system: that's not a command lol");
			}
			return; // Exit the function since we handled a command
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
			author: "#fc03baph",
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
    });
});


httpserver.listen(config.PORT, () => {
    console.log(JSON.stringify(config));
    console.log(`server running at http://localhost:${config.PORT}`);
});
