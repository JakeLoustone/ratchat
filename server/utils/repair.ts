import { dirname, basename, extname, join } from 'path';
import { existsFile } from './serialize';
import { AppError } from './errors';

export function getRepairPath(originalPath: string): string {
	const dir = dirname(originalPath);
	const ext = extname(originalPath);
	const base = basename(originalPath, ext);
	return join(dir, `repair-${base}${ext}`);
}

export function assertRepairClear(path: string){
	if(existsFile(getRepairPath(path))){
		throw new AppError(`Repair file present at ${path}, aborting`, 'internal', 'error');
	}
}