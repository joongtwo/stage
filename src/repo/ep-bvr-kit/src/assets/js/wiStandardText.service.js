// @<COPYRIGHT>@
// ==================================================
// Copyright 2019.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 *
 * @module js/wiStandardText.service
 */
import eventBus from 'js/eventBus';
import parsingUtils from 'js/parsingUtils';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import wiEditorService from 'js/wiEditor.service';
import wiCkeditor5Service from 'js/wiCkeditor5Service';


const STANDARD_TEXT_ELEMENT = 'stx';
const STANDARD_TEXT_MARKER = '\\\\';


/**
 *
 * @param {Object} response response
 * @returns {Array} standard text element revision list
 */
export function getStandardTextElementRevisionList( response ) {
    let standardTextElementRevisionList = [];
    const standardTextSearchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
    if( standardTextSearchResults && standardTextSearchResults.objects && standardTextSearchResults.objects.length > 0 ) {
        standardTextElementRevisionList = standardTextSearchResults.objects.map( object  => cdm.getObject( object.uid ) );
    }
    return standardTextElementRevisionList;
}

/**
 *
 * @param {Array} selectedObjects selected objects
 */
export function addSelectedStandardText( selectedObjects ) {
    if( selectedObjects && selectedObjects.length === 1 ) {
        const stxElementModelObject = cdm.getObject( selectedObjects[ 0 ].uid );

        eventBus.publish( 'wi.closeAutoPredictListPopup' );
        const selectedEditorInstanceId = wiEditorService.getSelectedEditorObjectData().editorInstanceId;
        const selectedEditorInstance = selectedEditorInstanceId && wiEditorService.getEditorInstance( selectedEditorInstanceId );

        let stxElementContent = '';
        if( stxElementModelObject && stxElementModelObject.props.epw0mes0WIStrings ) {
            const uid = stxElementModelObject.uid;
            stxElementContent =  stxElementModelObject.props.epw0mes0WIStrings.uiValues;
            const name = stxElementModelObject.props.object_string.uiValues[0];
            wiCkeditor5Service.insertStandardTextContent( selectedEditorInstance, STANDARD_TEXT_MARKER, STANDARD_TEXT_ELEMENT, stxElementContent, { uid, name } );

            let dirtyEditors = appCtxService.getCtx( 'wiEditor.dirtyEditor' );
            dirtyEditors[ selectedEditorInstanceId ].data.newlyAddedStxElementsUID.push( stxElementModelObject.uid );
            appCtxService.updatePartialCtx( 'wiEditor.dirtyEditor', dirtyEditors );
        }
    }
}

let exports = {};
export default exports = {
    getStandardTextElementRevisionList,
    addSelectedStandardText
};
