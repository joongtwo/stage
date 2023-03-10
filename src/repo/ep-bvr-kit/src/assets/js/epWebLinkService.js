// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import eventBus from 'js/eventBus';

/**
 * WebLinks Service for EasyPlan.
 *
 * @module js/epWebLinkService
 */

const NEW_WEB_LINK_ID = "newWebLinkObjectID";

/**
 * Add a new webLink
 *
 * @param {object} data - ViewModel data
 * @param {Object} scopeObject - the object to add the new webLink to
 */
export function addWebLink( data, scopeObject ) {
    const objectMap = {
        id: NEW_WEB_LINK_ID,
        connectTo: scopeObject.uid,
        Type: [ "Form" ],
        FormType: [ "Web Link" ]
    };

    let url = data.url.dbValue;
    const HTTP = "http://";
    const HTTPS = "https://";
    url = !url.includes( HTTP ) && !url.includes( HTTPS ) ? HTTPS + url : url;

    const propsMap = {
        itemPropMap: {
            object_name: data.name.dbValue,
            object_desc: data.description.dbValue
        },
        additionalPropMap: {
            url: url
        }
    };

    const saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addCreateObject( objectMap, propsMap );
    epSaveService.saveChanges( saveInputWriter, true, [ scopeObject ] ).then( result => {
        const createdWebLinkObj = getNewlyCreatedWebLink( result.saveResults );
        createdWebLinkObj && eventBus.publish( 'epWebLinkCreated', createdWebLinkObj );
    });
}

/**
 * Get the newly created web link object
 *
 * @param {object} saveResults - the save soa call response
 *
 * @returns {object} the newly created web link object
 */
export function getNewlyCreatedWebLink( saveResults ) {
    let webLinkObj = null;
    const createdForm = saveResults.filter( obj => obj.clientID === NEW_WEB_LINK_ID );
    if( createdForm && createdForm[ 0 ] && createdForm[ 0 ].saveErrors.length === 0 ) {
        webLinkObj = createdForm[ 0 ].saveResultObject;
    }
    return webLinkObj;
}

const exports = {
    addWebLink,
    getNewlyCreatedWebLink
};

export default exports;
