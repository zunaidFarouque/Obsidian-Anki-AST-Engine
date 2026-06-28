export function parseScanFolders(scanFolders: string): string[] {
	const folders = scanFolders
		.split(',')
		.map((folder) => folder.trim())
		.filter((folder) => folder.length > 0);

	return folders.length > 0 ? folders : ['.'];
}

export function isOutsideScanFolders(
	filePath: string,
	scanFoldersSetting: string,
): boolean {
	const folders = parseScanFolders(scanFoldersSetting);
	if (folders.includes('.')) {
		return false;
	}

	const normalized = filePath.replace(/\\/g, '/');
	return !folders.some(
		(folder) => normalized === folder || normalized.startsWith(`${folder}/`),
	);
}
