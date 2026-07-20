import type {RatServer, RatSocket} from './def-events';
import type {Identity} from './def-identity';

export type Command = {
	socket: RatSocket;
	io: RatServer;
	args: string[];
	fullArgs: string;
	commandUser: Identity | null;
	commandName: string;
}
export type GameCommand = Omit<Command, 'commandUser'> & { commandUser: Identity };
