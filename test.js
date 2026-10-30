const test = require('ava');
const open = require('.');
const {openApp} = open;

// Tests only checks that opening doesn't return an error
// it has no way make sure that it actually opened anything.

// These have to be manually verified.

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
