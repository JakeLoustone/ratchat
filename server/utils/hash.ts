import crypto from 'crypto';

export function hashIP(ip: string): string{
	if(!process.env.IP_PEPPER){
        throw new Error('No IP_PEPPER set, hash failed');
	}
	const pepper = process.env.IP_PEPPER
	const hash = crypto.createHash('sha256')
	hash.update(ip + pepper);
	return hash.digest('hex');
}