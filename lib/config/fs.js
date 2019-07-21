const jsonfile = require('jsonfile');
const Path = require('path');

let configDir;

class Fs {

    static init(dir) {
        configDir = dir;
    }

    static get configDir() {
        return configDir;
    }

    static readFS(fileName) {
        let file = Path.join(configDir, fileName);
        try { return jsonfile.readFileSync(file); }
        catch (e) {
            if (e.code === 'ENOENT') {
                console.log('No such file or directory:', fileName);
            } else {
                console.error('Cannot read file: %s, error: %s', fileName, e);
            }
            return {};
        }
    }

    static writeFS(fileName, object) {
        let file = Path.join(configDir, fileName);
        jsonfile.writeFileSync(file, object, err => {
            console.error('Cannot write object: %s, to: %s, error: %s', JSON.stringify(object), fileName, err);
        });
    }
}

module.exports = Fs;