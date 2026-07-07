import { dirname, basename, extname, join } from 'path';
import { existsFile } from './serialize';

export function getRepairPath(originalPath: string): string {
	const dir = dirname(originalPath);
	const ext = extname(originalPath);
	const base = basename(originalPath, ext);
	return join(dir, `repair-${base}${ext}`);
}

export function existsRepairFile(originalPath: string): boolean {
	return existsFile(getRepairPath(originalPath));
}