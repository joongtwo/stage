// Copyright (c) 2022 Siemens

/**
 * This module provides services for saving command data on session storage for user
 *
 * @module js/viewerSessionStorageService
 */
import _cdmSvc from 'soa/kernel/clientDataModel';

var exports = {};

/**
 * Stores command data on session storage for active user
 * @param {String} commandId Name of the command for which data will be stored
 * @param {Object} data data to be stored on session storage
 */
export let setViewerCommandDataToSessionStorage = function( commandId, data ) {
    if( commandId === undefined ) {
        return;
    }
    const userName = _cdmSvc.getUser().props.user_name.uiValues[ 0 ];
    try{
        let userCommandData = JSON.parse( window.sessionStorage.getItem( userName ) );
        if( userCommandData ) {
            userCommandData[commandId] = data;
        } else {
            userCommandData = {};
            userCommandData[commandId] = data;
        }
        window.sessionStorage.setItem( userName, JSON.stringify( userCommandData ) );
    } catch  {
        return;
    }
};

/**
 * Retrives command data from session storage for active user
 * @param {String} commandId Name of the command for which data will be retrived
 */
export let getViewerCommandDataToSessionStorage = function( commandId ) {
    const userName = _cdmSvc.getUser().props.user_name.uiValues[ 0 ];
    let userData = null; let commandData = null;
    try {
        userData = JSON.parse( window.sessionStorage.getItem( userName ) );
    } catch  {
        return null;
    }
    if( userData ) {
        commandData = userData[commandId];
    }
    return commandData;
};

export default exports = {
    setViewerCommandDataToSessionStorage,
    getViewerCommandDataToSessionStorage
};
