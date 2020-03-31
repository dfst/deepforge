const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);
const PROJECT_ROOT = path.resolve(path.join(__dirname, '..'));

main();

async function asyncFlatMap(list, fn) {
    return (await Promise.all(
        list.map(fn)
    )).flat();
}

async function allFilenames(dir) {
    const contents = (await readdir(dir))
        .map(name => path.join(dir, name));

    const files = asyncFlatMap(
        contents,
        async name => {
            const stats = await stat(name);
            if (stats.isFile()) {
                return [name];
            } else {
                return allFilenames(name);
            }
        }
    );

    return files;
}

async function* testFiles() {
    const testDir = path.join(PROJECT_ROOT, 'test');
    const files = (await allFilenames(testDir))
        .filter(name => name.endsWith('.js'));

    for (const filepath of files) {
        yield [filepath, await readFile(filepath, 'utf8')];
    }
}

async function noMochaOnlyKeyword() {
    const ONLY_REGEX = /(it|describe)\.only\(/;
    const errors = [];
    for await (const [filename, contents] of testFiles()) {
        for (let line of contents.split('\n')) {
            if (ONLY_REGEX.test(line)) {
                const relpath = filename.replace(PROJECT_ROOT, '');
                errors.push(new SkippedTestsError(relpath, line));
            }
        }
    }
    return errors;
}

class SkippedTestsError extends Error {
    constructor(filename, line) {
        super(`".only" found in ${filename}: ${line}`);
    }
}

async function main() {
    const errors = await noMochaOnlyKeyword();
    if (errors.length) {
        console.error('The following additional CI checks failed:\n');
        errors.forEach(err => console.error(err, '\n'));
        process.exit(1);
    }
}
