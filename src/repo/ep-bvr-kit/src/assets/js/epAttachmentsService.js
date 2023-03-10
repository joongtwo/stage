// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * This service helps create and attach a dataset to an object.
 *
 * @module js/epAttachmentsService
 */
import _ from 'lodash';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import eventBus from 'js/eventBus';


/**
 * Create and attach the object.
 * @param {*} connectedToObject - object to connect to
 * @param {*} type - type of object
 * @param {*} relationType - relation type
 * @param {*} objectName - object name
 * @param {*} objectDesc - object description
 * @returns {*} - return Response Object
 */
function createAttachmentObjectAndAttach( connectedToObject, type, relationType, objectName, objectDesc ) {
    const newObjectUid = 'new_object_id' + Math.random().toString();
    const objectsToCreateEntry = {
        Object: {
            nameToValuesMap: {
                id: [ newObjectUid ],
                connectTo: [ connectedToObject.uid ],
                Type: [ getDatasetType( type ) ],
                RelationType: [ relationType ]
            }
        },
        ItemProps: {
            nameToValuesMap: {
                object_name: [ objectName ]
            }
        }
    };
    if( objectDesc ) {
        objectsToCreateEntry.ItemProps.nameToValuesMap.object_desc = [ objectDesc ];
    }
    let saveInputWriter = saveInputWriterService.get();
    saveInputWriter.addEntryToSection( epSaveConstants.OBJECTS_TO_CREATE, objectsToCreateEntry );
    return epSaveService.saveChanges( saveInputWriter, true, [ connectedToObject ] ).then( ( responseObj ) => {
        //Response is null if save action is cancelled(e.g. Revise action on released object before attaching a file is cancelled )
        //No save events in case the saveChanges fails
        if( !responseObj || responseObj.saveEvents === undefined ) {
            eventBus.publish( 'progress.end' );
            eventBus.publish( 'epAttachFile.closePopupWindow' );
            return responseObj;
        }
    } );
}
/**
 * return the dataset type of an input object
 * @param {object} datasetTypeProp - Dataset type object
 * @returns {string} - return the dataset type
 */
function getDatasetType( datasetTypeProp ) {
    let datasetTypePropIn = datasetTypeProp.getValue ? datasetTypeProp.getValue() : datasetTypeProp.dbValue;

    //when input value into reference LOV directly, datasetTypeProp.dbValue.props will be undefined.
    let dtObjRefVals = _.get( datasetTypePropIn, 'props.object_string.dbValues' );
    let dtObjRefVal = '';
    if( dtObjRefVals && _.isArray( dtObjRefVals ) ) {
        dtObjRefVal = dtObjRefVals[ 0 ];
    } else {
        dtObjRefVal =  datasetTypePropIn;
    }

    return dtObjRefVal;
}

export default {
    createAttachmentObjectAndAttach
};
