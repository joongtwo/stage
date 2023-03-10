// Copyright (c) 2022 Siemens

/**
 * @module js/mrlDashboardUtils
 */
import localeService from 'js/localeService';

var exports = {};

/**
 * Get the message for given key from mrl resource file and return the localized string.
 *
 * @param {String} resourceKey - The message key which should be looked-up
 * @returns {String} localizedValue - The localized message string
 */
export let getMRLDashboardLocalizedMessage = function( resourceKey ) {
    var localizedValue = null;
    var resource = 'mrlMessages';
    var localTextBundle = localeService.getLoadedText( resource );
    if( localTextBundle ) {
        localizedValue = localTextBundle[ resourceKey ];
    } else {
        var asyncFun = function( localTextBundle ) {
            localizedValue = localTextBundle[ resourceKey ];
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }
    return localizedValue;
};

/**
 * It returns UID of "MRL New Resources" folder.
 * @param {Object} response - the response of folder search
 */
export let getMRLNewResourcesFolderUid = function( response ) {
    var folderUid = '';
    var searchResults = response.ServiceData.modelObjects;
    if( searchResults ) {
        for( var folderObject in searchResults ) {
            folderUid = searchResults[ folderObject ].uid;
        }
    }

    return folderUid;
};

export default exports = {
    getMRLDashboardLocalizedMessage,
    getMRLNewResourcesFolderUid
};
