const fs = require('fs');
const path = require('path');
const cla = require('command-line-args');

const optionDefinitions = [
    { name: 'path', type: String, multiple: false, defaultOption: true },
    { name: 'output', type: String, multiple: false, defaultValue: './res.pak.d' }
];

const options = cla(optionDefinitions);

if(!options.path) {
    console.log('Usage: packdbj.js [path to pak file].pak');
    return;
}

if(!fs.existsSync(options.path)) {
    console.error(`${options.path} doesn't exist!`);
    return;
}

const pakfile = fs.readFileSync(options.path);

console.log('Parsing PAK Header...');

// Header validation
if(pakfile.toString('ascii', 0, 3) !== 'PAK') {
    console.error('Invalid PAK file!');
    return;
}

if(pakfile.readInt8(3) !== 0) {
    console.error('Unsupported PAK version number!');
    return;
}

// Read header data

const headerSize = pakfile.readInt32LE(4);
const dataSize = pakfile.readInt32LE(8);

console.log(`PAK Header Size: ${headerSize} Bytes`);
console.log(`PAK Data Size: ${dataSize} Bytes`);
console.log('PAK Header successfully parsed...\n');

// Parse files
function parseFile(offset) {
    let file = {
        offset: 0,
        dataPosition: null,
        dataSize: null,
        endOffset: null,
        checksum: null,
        sizeFileName: 0,
        fileName: null,
        flags: 0,
        isDirectory: false,
        children: []
    };

    file.offset = offset;
    file.sizeFileName = pakfile.readInt8(offset++);
    file.fileName = pakfile.toString('ascii', offset, (offset += file.sizeFileName));

    file.flags = pakfile.readInt8(offset++);

    if(file.flags & 1) {
        file.isDirectory = true;
        file.childrenCount = pakfile.readInt32LE(offset);
        offset += 4;

        for(let i = 0; i < file.childrenCount; i++) {
            file.children.push(parseFile(offset));
            offset = file.children[file.children.length - 1].endOffset;
        }
    } else {
        file.isDirectory = false;
        if(file.flags & 2) {
            file.dataPosition = pakfile.readDoubleLE(offset);
            offset += 8;
        } else {
            file.dataPosition = pakfile.readInt32LE(offset);
            offset += 4;
        }

        file.dataSize = pakfile.readInt32LE(offset);
        offset += 4;

        file.checksum = pakfile.readInt32LE(offset);
        offset += 4;
    }

    file.endOffset = offset;

    return file;
}

const parsedPakFile = parseFile(12);

let itemCount = 0;

function unpack(item, root) {
    if(item.isDirectory) {
        if(item.fileName == '') {
            item.fileName = '.';
        }

        const newRoot = path.join(root, item.fileName);
        fs.mkdirSync(newRoot, {recursive: true});

        for(const child of item.children) {
            unpack(child, newRoot);
        }
    } else {
        fs.writeFileSync(path.join(root, item.fileName), pakfile.slice(headerSize + item.dataPosition, headerSize + item.dataPosition + item.dataSize));
    }

    itemCount++;
}

unpack(parsedPakFile, options.output);

console.log(`Done! Unpacked ${itemCount} items in total!`);