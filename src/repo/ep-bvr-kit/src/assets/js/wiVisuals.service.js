// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/wiVisuals.service
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';
import wiEditorService from 'js/wiEditor.service';
import wiCkeditor5Service from 'js/wiCkeditor5Service';
import { constants as epBvrConstants } from 'js/epBvrConstants';


const VISUALS_ELEMENT = 'visuals';
const VISUALS_MARKER = '{{';

const _datasetTypes = [ epBvrConstants.JPEG_OBJECT_TYPE, epBvrConstants.BITMAP_OBJECT_TYPE,
    epBvrConstants.IMAGE_OBJECT_TYPE, epBvrConstants.SNAPSHOT_OBJECT_TYPE,
    epBvrConstants.GIF_OBJECT_TYPE
];

/**
  *
  * @param {Array} selectedObjects selected objects
  */
export function addSelectedVisual( selectedObjects ) {
    if ( selectedObjects[0] && selectedObjects[0].objectId ) {
        let selectedVisualObject = cdm.getObject( selectedObjects[0].objectId );

        eventBus.publish( 'wi.closeAutoPredictListPopup' );

        let visualName = '';
        const selectedEditorInstanceId = wiEditorService.getSelectedEditorObjectData().editorInstanceId;
        const selectedEditorInstance = selectedEditorInstanceId && wiEditorService.getEditorInstance( selectedEditorInstanceId );
        if ( selectedVisualObject ) {
            if( mfeTypeUtils.isOfTypes( selectedVisualObject, [ epBvrConstants.SNAPSHOT_OBJECT_TYPE ] ) ) {
                visualName += selectedVisualObject.props.object_string.uiValues[ 0 ] ? selectedVisualObject.props.object_string.uiValues[ 0 ] : selectedVisualObject.props.object_string.dbValues;
            } else {
                visualName += selectedVisualObject.props.ref_list.uiValues[0];
            }
            const uid = selectedVisualObject.uid;
            const name = visualName;
            wiCkeditor5Service.insertContent( selectedEditorInstance, VISUALS_MARKER, VISUALS_ELEMENT, { uid, name } );
            let dirtyEditors = appCtxService.getCtx( 'wiEditor.dirtyEditor' );
            dirtyEditors[selectedEditorInstanceId].data.newlyAddedVisualsUID.push( selectedVisualObject.uid );
            appCtxService.updatePartialCtx( 'wiEditor.dirtyEditor', dirtyEditors );
        }
    }
}

/**
  *
  * @param {String} filterString str
  * @param {int} startIndex index
  * @returns {Object} list
  */
export function filterVisualsList( filterString, startIndex ) {
    let visualsDatasetList = getVisualDatasetstoShow();
    let filteredListOfVisuals = [];

    let viusalsAndPVsList = fliterPVsandVisualsFromFilmStripDatasets( visualsDatasetList );

    if( !filterString ) {
        filterString = '';
    }
    //To include * regex to search all visuals
    filterString = wiEditorService.replaceAll( filterString, '*', '' );

    viusalsAndPVsList.forEach( visualDataset => {
        let objectName = visualDataset.objectName;
        if ( _.includes( objectName.toUpperCase(), filterString.toUpperCase()  )  ) {
            filteredListOfVisuals.push( visualDataset );
        }
    } );

    // Sort the list before showing in the popup
    filteredListOfVisuals.sort( ( set1, set2 ) => {
        const name1 = set1.objectName;
        const name2 = set2.objectName;
        if( name1 < name2 ) {
            return -1;
        } else if( name1 === name2 ) {
            return 0;
        }
        return 1;
    } );

    return {
        filteredListOfVisuals: filteredListOfVisuals,
        totalFound: filteredListOfVisuals.length
    };
}


/**
  *
  * @returns {Array} visualsDatasetList
  */
function getVisualDatasetstoShow() {
    let visualsDatasetList = [];
    let selectedEditorObject = wiEditorService.getSelectedEditorObjectData().selectedObject;
    if( selectedEditorObject && selectedEditorObject.props && selectedEditorObject.props.mbc0AttachedFiles !== undefined ) {
        visualsDatasetList = selectedEditorObject.props.mbc0AttachedFiles.dbValues.map( uid =>
            cdm.getObject( uid )
        );
    }
    return visualsDatasetList;
}


/**
  *
  * @param {Arary} visualsDatasetList list
  * @returns {Array} viusalsAndPVsList
  */
function fliterPVsandVisualsFromFilmStripDatasets( visualsDatasetList ) {
    let viusalsAndPVsList = [];
    visualsDatasetList.forEach( object => {
        if ( !_.includes( _datasetTypes, object.type ) ) {
            return;
        }

        let objectName = '';
        let objectId = '';
        if( mfeTypeUtils.isOfTypes( object, [ epBvrConstants.SNAPSHOT_OBJECT_TYPE ] ) ) {
            objectName = object.props.object_string.uiValues[ 0 ] ? object.props.object_string.uiValues[ 0 ] : object.props.object_string.dbValues;
        } else {
            objectName = object.props.ref_list.uiValues[0];
        }
        objectId = object.uid;
        viusalsAndPVsList.push( { objectName:objectName, objectId:objectId } );
    } );

    return viusalsAndPVsList;
}


let exports = {};
export default exports = {
    filterVisualsList,
    addSelectedVisual
};

