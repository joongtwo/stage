// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 *
 * @module js/wiPartsTools.service
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import wiEditorService from 'js/wiEditor.service';
import dmSvc from 'soa/dataManagementService';
import wiCkeditor5Service from 'js/wiCkeditor5Service';
import { constants as epBvrConstants } from 'js/epBvrConstants';

const AUTO_PREDICT_PARTS_ASSIGNMENTS = 'Assignments';
const AUTO_PREDICT_PARTS_CTX = 'preferences.EP_AutoPredictForPartsSource';
const PARTS_TOOLS_ELEMENT = 'parts-tools';
const PARTS_TOOLS_MARKER = '[[';


/**
 *
 * @param {Array} selectedObjects selected objects
 */
function addSelectedPartsTools( selectedObjects ) {
    if ( selectedObjects[0] && selectedObjects[0].uid ) {
        const selectedPartToolObject = cdm.getObject( selectedObjects[0].uid );

        eventBus.publish( 'wi.closeAutoPredictListPopup' );

        let partToolName = '';
        const selectedEditorInstanceId = wiEditorService.getSelectedEditorObjectData().editorInstanceId;
        const selectedEditorInstance = selectedEditorInstanceId && wiEditorService.getEditorInstance( selectedEditorInstanceId );

        if ( selectedEditorInstance && selectedPartToolObject && selectedPartToolObject.props.bl_rev_object_name && selectedPartToolObject.props.bl_item_item_id.uiValues[0] ) {
            partToolName += selectedPartToolObject.props.bl_item_item_id.uiValues[0] + '/' + selectedPartToolObject.props.bl_rev_object_name.uiValues[0];
            const uid = selectedPartToolObject.uid;
            const name = partToolName;
            wiCkeditor5Service.insertContent( selectedEditorInstance, PARTS_TOOLS_MARKER, PARTS_TOOLS_ELEMENT, { uid, name } );
            let dirtyEditors = appCtxService.getCtx( 'wiEditor.dirtyEditor' );
            dirtyEditors[selectedEditorInstanceId].data.newlyAddedPartsToolsUID.push( selectedPartToolObject.uid );
            appCtxService.updatePartialCtx( 'wiEditor.dirtyEditor', dirtyEditors );
        }
    }
}

/**
 *
 * @param {String} filterString filter string
 * @returns {Object} filtered parts tools list
 */
export function filterPartsAndToolsList( filterString ) {
    let partsToolsList = getPartsAndToolsList();
    let filteredListOfPartsTools = [];

    if( !filterString ) {
        filterString = '';
    }
    //To include * regex to search all parts tools
    filterString = wiEditorService.replaceAll( filterString, '*', '' );

    for ( let i = 0; i < partsToolsList.length; i++ ) {
        let objectName = partsToolsList[i].props.object_string.uiValues[0];

        if ( _.includes( objectName.toUpperCase(), filterString.toUpperCase() ) ) {
            filteredListOfPartsTools.push( partsToolsList[i] );
        }
    }

    return {
        filteredListOfPartsTools: filteredListOfPartsTools,
        totalFound: filteredListOfPartsTools.length
    };
}


/**
 * @return {Object} :parts and tools list
 */
function getPartsAndToolsList() {
    //get selection in process grid
    let selectedObject = wiEditorService.getSelectedEditorObjectData().selectedObject;
    let partsAndToolsObjectList = [];

    const autoPredictPartsPref = appCtxService.getCtx( AUTO_PREDICT_PARTS_CTX );
    if( autoPredictPartsPref && autoPredictPartsPref[0] === AUTO_PREDICT_PARTS_ASSIGNMENTS ) {
        let partsToolsUidsList = [];
        //Get parts and tools list from Selected Object
        if( selectedObject && selectedObject.props && selectedObject.props.Mfg0all_material !== undefined ) {
            let partsList = selectedObject.props.Mfg0all_material.dbValues.map( uid => cdm.getObject( uid ) );
            selectedObject.props.Mfg0all_material.dbValues.map( uid => partsToolsUidsList.push( uid ) );
            partsAndToolsObjectList = partsAndToolsObjectList.concat( partsList );
        }
        if( selectedObject && selectedObject.props && selectedObject.props.Mfg0used_equipment !== undefined ) {
            let toolslist = selectedObject.props.Mfg0used_equipment.dbValues.map( uid => cdm.getObject( uid ) );
            selectedObject.props.Mfg0used_equipment.dbValues.map( uid => partsToolsUidsList.push( uid ) );
            partsAndToolsObjectList = partsAndToolsObjectList.concat( toolslist );
        }
        dmSvc.getProperties( partsToolsUidsList, [ epBvrConstants.BL_ITEM_ITEM_ID ] );
    }

    //Get parts list from Assembly Structure
    else {
        partsAndToolsObjectList = getPartsListFromAssemblyStructure();
    }
    return partsAndToolsObjectList;
}

/**
 * createPartsListFromAssemblyStructure
 * @returns {Array} parts list
 */
function getPartsListFromAssemblyStructure( ) {
    let partsList = [];
    const loadedProductViewModel = appCtxService.getCtx( 'ep.loadedProductObject' );
    if( loadedProductViewModel && loadedProductViewModel.uid ) {
        const assemblyStructure = cdm.getObject( loadedProductViewModel.uid );
        if( assemblyStructure && assemblyStructure.props && assemblyStructure.props.bl_all_child_lines !== undefined ) {
            partsList = assemblyStructure.props.bl_all_child_lines.dbValues.map( uid =>
                cdm.getObject( uid )
            );
        }
    }
    return partsList;
}

let exports = {};
export default exports = {
    filterPartsAndToolsList,
    addSelectedPartsTools
};
