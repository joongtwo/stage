// Copyright (c) 2022 Siemens

/**
 * @module js/fileDownloadService
 */
var exports = {};

/**
 * Prepare download file message
 * @param {OBJECT} data - declarative ViewModel Information
 * @param {String} textMsgParamForImanFileObj  - file name derived from ImanFile object
 * @param {String} textMsgParamForDatasetObj  - file name derived from Dataset object
 * @return {String } finalMessage - Final message to be displayed in the sublocation view
 */
export let prepareMessageBeforeDownload = function( data, textMsgParamForImanFileObj, textMsgParamForDatasetObj ) {
    var finalMessage = null;
    if( textMsgParamForImanFileObj !== undefined ) {
        finalMessage = data.i18n.fileDownloadRetryMessage.replace( '{0}', textMsgParamForImanFileObj );
    }
    if( textMsgParamForDatasetObj !== undefined ) {
        finalMessage = data.i18n.fileDownloadRetryMessage.replace( '{0}', textMsgParamForDatasetObj );
    }
    return finalMessage;
};

export default exports = {
    prepareMessageBeforeDownload
};
