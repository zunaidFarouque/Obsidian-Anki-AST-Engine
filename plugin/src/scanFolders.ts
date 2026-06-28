export function parseScanFolders(scanFolders: string): string[] {
	const folders = scanFolders
		.split(',')
		.map((folder) => folder.trim())
		.filter((folder) => folder.length > 0);

	return folders.length > 0 ? folders : ['.'];
}
