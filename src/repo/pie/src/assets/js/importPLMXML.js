// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */
/**
 * @module js/importPLMXML
 */
import _ from 'lodash';
import _appCtxSvc from 'js/appCtxService';

'use strict';
var exports = {};

export let getSOAInputForPLMXMLImport = function( data ) {
    return {
        zipFileTicket: data.fmsTicket,
        transferMode: { uid: data.transferModeListBox.dbValue.uid, type: 'unknownType' },
        sessionOptions: data.sessionOptionsForImport
    };
};

/**
 * collectSessionOption
 */
function collectSessionOption( ctx ) {
    var sessionOptionNamesValues = [];

    var pdiIOR = { optionName: 'pdiIOR', optionValue: '' };
    sessionOptionNamesValues.push( pdiIOR );

    var soaIOR = { optionName: 'soaIOR', optionValue: '' };
    sessionOptionNamesValues.push( soaIOR );
    
    var selectedFolderUId = '';
    if ( ctx.mselected && ctx.mselected.length > 0 && ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        selectedFolderUId = ctx.mselected[0].uid;
    } else if ( ctx.locationContext.modelObject && ctx.locationContext.modelObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        selectedFolderUId = ctx.locationContext.modelObject.uid;
    }

    if ( selectedFolderUId.length > 0 ) {
        var folderUID = { optionName: 'folderuid', optionValue: selectedFolderUId };
        sessionOptionNamesValues.push( folderUID );
    }


    return sessionOptionNamesValues;
}

export let clearTransferModes = function( ) {
    return{
        emptyString: '',
        emptyArray: []
    };
};

/**
 * Since this module can be loaded as a dependent DUI module we need to return an object indicating which
 * service should be injected to provide the API for this module.
 */
export let moduleServiceNameToInject = 'importPLMXML';
export default exports = {        
    getSOAInputForPLMXMLImport,
    collectSessionOption,
    clearTransferModes
};
