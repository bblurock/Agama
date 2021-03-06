const fs = require('fs-extra');
const _fs = require('graceful-fs');
const Promise = require('bluebird');

module.exports = (shepherd) => {
  shepherd.zcashParamsDownloadLinks = {
    'agama.komodoplatform.com': {
      proving: 'https://agama.komodoplatform.com/file/supernet/sprout-proving.key',
      verifying: 'https://agama.komodoplatform.com/file/supernet/sprout-verifying.key',
    },
    'agama-yq0ysrdtr.stackpathdns.com': {
      proving: 'http://agama-yq0ysrdtr.stackpathdns.com/file/supernet/sprout-proving.key',
      verifying: 'http://agama-yq0ysrdtr.stackpathdns.com/file/supernet/sprout-verifying.key',
    },
    'zcash.dl.mercerweiss.com': {
      proving: 'https://zcash.dl.mercerweiss.com/sprout-proving.key',
      verifying: 'https://zcash.dl.mercerweiss.com/sprout-verifying.key',
    },
  };

  shepherd.zcashParamsExist = () => {
    let _checkList = {
      rootDir: _fs.existsSync(shepherd.zcashParamsDir),
      provingKey: _fs.existsSync(`${shepherd.zcashParamsDir}/sprout-proving.key`),
      provingKeySize: false,
      verifyingKey: _fs.existsSync(`${shepherd.zcashParamsDir}/sprout-verifying.key`),
      verifyingKeySize: false,
      errors: false,
    };

    if (_checkList.rootDir &&
        _checkList.provingKey ||
        _checkList.verifyingKey) {
      // verify each key size
      const _provingKeySize = _checkList.provingKey ? fs.lstatSync(`${shepherd.zcashParamsDir}/sprout-proving.key`) : 0;
      const _verifyingKeySize = _checkList.verifyingKey ? fs.lstatSync(`${shepherd.zcashParamsDir}/sprout-verifying.key`) : 0;

      if (Number(_provingKeySize.size) === 910173851) { // bytes
        _checkList.provingKeySize = true;
      }
      if (Number(_verifyingKeySize.size) === 1449) {
        _checkList.verifyingKeySize = true;
      }

      shepherd.log('zcashparams exist');
    } else {
      shepherd.log('zcashparams doesnt exist');
    }

    if (!_checkList.rootDir ||
        !_checkList.provingKey ||
        !_checkList.verifyingKey ||
        !_checkList.provingKeySize ||
        !_checkList.verifyingKeySize) {
      _checkList.errors = true;
    }

    return _checkList;
  }

  shepherd.zcashParamsExistPromise = () => {
    return new Promise((resolve, reject) => {
      const _verify = shepherd.zcashParamsExist();
      resolve(_verify);
    });
  };

  /*
   *  Update bins
   *  type:
   *  params:
   */
  shepherd.get('/zcparamsdl', (req, res, next) => {
    if (shepherd.checkToken(req.query.token)) {
      // const dlLocation = shepherd.zcashParamsDir + '/test';
      const dlLocation = shepherd.zcashParamsDir;
      const dlOption = req.query.dloption;

      const successObj = {
        msg: 'success',
        result: 'zcash params dl started',
      };

      res.end(JSON.stringify(successObj));

      for (let key in shepherd.zcashParamsDownloadLinks[dlOption]) {
        shepherd.downloadFile({
          remoteFile: shepherd.zcashParamsDownloadLinks[dlOption][key],
          localFile: `${dlLocation}/sprout-${key}.key`,
          onProgress: (received, total) => {
            const percentage = (received * 100) / total;

            if (percentage.toString().indexOf('.10') > -1) {
              shepherd.io.emit('zcparams', {
                msg: {
                  type: 'zcpdownload',
                  status: 'progress',
                  file: key,
                  bytesTotal: total,
                  bytesReceived: received,
                  progress: percentage,
                },
              });
              // shepherd.log(`${key} ${percentage}% | ${received} bytes out of ${total} bytes.`);
            }
          }
        })
        .then(() => {
          const checkZcashParams = shepherd.zcashParamsExist();

          shepherd.log(`${key} dl done`);

          if (checkZcashParams.error) {
            shepherd.io.emit('zcparams', {
              msg: {
                type: 'zcpdownload',
                file: key,
                status: 'error',
                message: 'size mismatch',
                progress: 100,
              },
            });
          } else {
            shepherd.io.emit('zcparams', {
              msg: {
                type: 'zcpdownload',
                file: key,
                progress: 100,
                status: 'done',
              },
            });
            shepherd.log(`file ${key} succesfully downloaded`);
          }
        });
      }
    } else {
      const errorObj = {
        msg: 'error',
        result: 'unauthorized access',
      };

      res.end(JSON.stringify(errorObj));
    }
  });

  return shepherd;
};