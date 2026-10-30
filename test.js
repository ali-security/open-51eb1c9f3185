const childProcess = require('child_process');
const test = require('ava');
const open = require('.');
const {openApp} = open;

// Tests only checks that opening doesn't return an error
// it has no way make sure that it actually opened anything.

// These have to be manually verified.

// Load a fresh copy of the module as if it was running on Windows, so the PowerShell command it builds can be inspected on any platform.
const loadWindowsOpen = () => {
	const modulePath = require.resolve('.');
	const cachedModule = require.cache[modulePath];
	const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

	delete require.cache[modulePath];
	Object.defineProperty(process, 'platform', {value: 'win32'});

	try {
		return require('.');
	} finally {
		Object.defineProperty(process, 'platform', platformDescriptor);
		require.cache[modulePath] = cachedModule;
	}
};

// Run `callback` with a Windows copy of the module and return the decoded `-EncodedCommand` script it would hand to PowerShell.
const getPowerShellCommand = async callback => {
	const windowsOpen = loadWindowsOpen();
	const originalSpawn = childProcess.spawn;
	let spawnArguments;

	childProcess.spawn = (command, args) => {
		spawnArguments = args;
		return {unref() {}};
	};

	try {
		await callback(windowsOpen);
	} finally {
		childProcess.spawn = originalSpawn;
	}

	return Buffer.from(spawnArguments[spawnArguments.length - 1], 'base64').toString('utf16le');
};

test('open file in default app', async t => {
	await t.notThrowsAsync(open('index.js'));
});

test('wait for the app to close if wait: true', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com', {wait: true}));
});

test('encode URL if url: true', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com', {url: true}));
});

test('open URL in default app', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com'));
});

test('open URL in specified app', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com', {app: {name: open.apps.chrome}}));
});

// The asserted spawnargs (`open -a … --args …`) are the macOS command line; on Linux the
// same call spawns the browser binary directly, so the assertion only holds on darwin.
if (process.platform !== 'darwin') {
	console.log('SKIP "open URL in specified app with arguments": asserts the macOS `open -a` spawnargs, not applicable on ' + process.platform);
}

(process.platform === 'darwin' ? test : test.skip)('open URL in specified app with arguments', async t => {
	await t.notThrowsAsync(async () => {
		const proc = await open('https://sindresorhus.com', {app: {name: open.apps.chrome, arguments: ['--incognito']}});
		t.deepEqual(proc.spawnargs, ['open', '-a', open.apps.chrome, 'https://sindresorhus.com', '--args', '--incognito']);
	});
});

test('return the child process when called', async t => {
	const childProcess = await open('index.js');
	t.true('stdout' in childProcess);
});

test('open URL with query strings', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com/?abc=123&def=456'));
});

test('open URL with a fragment', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com#projects'));
});

test('open URL with query strings and spaces', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com/?abc=123&def=456&ghi=with spaces'));
});

test('open URL with query strings and a fragment', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com/?abc=123&def=456#projects'));
});

test('open URL with query strings and pipes', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com/?abc=123&def=456&ghi=w|i|t|h'));
});

test('open URL with query strings, spaces, pipes and a fragment', async t => {
	await t.notThrowsAsync(open('https://sindresorhus.com/?abc=123&def=456&ghi=w|i|t|h spaces#projects'));
});

test('open URL with query strings and URL reserved characters', async t => {
	await t.notThrowsAsync(open('https://httpbin.org/get?amp=%26&colon=%3A&comma=%2C&commat=%40&dollar=%24&equals=%3D&plus=%2B&quest=%3F&semi=%3B&sol=%2F'));
});

test('open URL with query strings and URL reserved characters with `url` option', async t => {
	await t.notThrowsAsync(open('https://httpbin.org/get?amp=%26&colon=%3A&comma=%2C&commat=%40&dollar=%24&equals=%3D&plus=%2B&quest=%3F&semi=%3B&sol=%2F', {url: true}));
});

test('open URL with single backtick', async t => {
	await t.notThrowsAsync(open('https://httpbin.org/get?test=backtick ` here'));
});

test('open URL with double backticks', async t => {
	await t.notThrowsAsync(open('https://httpbin.org/get?test=backticks `` here'));
});

test.serial('open URL with PowerShell subexpression is not executed on Windows', async t => {
	const command = await getPowerShellCommand(windowsOpen => windowsOpen('https://example.com/?q=$(Start-Process calc)'));
	t.is(command, 'Start \'https://example.com/?q=$(Start-Process calc)\'');
});

test.serial('open URL with single quotes cannot break out of the PowerShell string on Windows', async t => {
	const command = await getPowerShellCommand(windowsOpen => windowsOpen('https://example.com/?q=\'; Start-Process calc; \''));
	t.is(command, 'Start \'https://example.com/?q=\'\'; Start-Process calc; \'\'\'');
});

test.serial('open URL with typographic single quotes cannot break out of the PowerShell string on Windows', async t => {
	// PowerShell also treats these as string delimiters, so they must be doubled too.
	for (const quote of ['\u2018', '\u2019', '\u201A', '\u201B']) {
		// eslint-disable-next-line no-await-in-loop
		const command = await getPowerShellCommand(windowsOpen => windowsOpen(`https://example.com/?q=${quote}; Start-Process calc; #`));
		t.is(command, `Start 'https://example.com/?q=${quote}${quote}; Start-Process calc; #'`);
	}

	// Double quotes are not delimiters inside a single-quoted string.
	const command = await getPowerShellCommand(windowsOpen => windowsOpen('https://example.com/?q=a\u201Cb\u201Dc\u201Ed"e'));
	t.is(command, 'Start \'https://example.com/?q=a\u201Cb\u201Dc\u201Ed"e\'');
});

test.serial('open URL with backticks and double quotes is passed literally to PowerShell on Windows', async t => {
	const command = await getPowerShellCommand(windowsOpen => windowsOpen('https://example.com/?q=`"; Start-Process calc; #'));
	t.is(command, 'Start \'https://example.com/?q=`"; Start-Process calc; #\'');
});

test.serial('open URL in specified app escapes the app name and arguments for PowerShell on Windows', async t => {
	const appName = 'C:\\Program Files\\$(Start-Process calc)\\app.exe';

	const command = await getPowerShellCommand(windowsOpen => windowsOpen('https://example.com/?q=$(Start-Process calc)', {
		app: {
			name: appName,
			arguments: ['--flag=$(Start-Process calc)', 'it\'s']
		}
	}));
	t.is(command, `Start '${appName}' -ArgumentList 'https://example.com/?q=$(Start-Process calc)','--flag=$(Start-Process calc)','it''s'`);

	const appCommand = await getPowerShellCommand(windowsOpen => windowsOpen.openApp(appName, {arguments: ['\'; Start-Process calc; \'']}));
	t.is(appCommand, `Start '${appName}' -ArgumentList '''; Start-Process calc; '''`);
});

test('open Firefox without arguments', async t => {
	await t.notThrowsAsync(openApp(open.apps.firefox));
});

// On Linux `apps.chrome` is an array of candidate binaries, which `openApp` (string-only name) rejects.
if (process.platform === 'linux') {
	console.log('SKIP "open Chrome in incognito mode": apps.chrome is an array on linux and openApp only accepts a string name');
}

(process.platform === 'linux' ? test.skip : test)('open Chrome in incognito mode', async t => {
	await t.notThrowsAsync(openApp(open.apps.chrome, {arguments: ['--incognito'], newInstance: true}));
});
